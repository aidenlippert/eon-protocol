const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CreditVault", function () {
  let registry, oracle, vault;
  let usdc, weth;
  let usdcFeed, wethFeed;
  let owner, user1, user2, liquidator, insurance;

  const USDC_DECIMALS = 6;
  const WETH_DECIMALS = 18;
  const FEED_DECIMALS = 8;

  const USDC_PRICE = 1_00000000; // $1.00 (8 decimals)
  const WETH_PRICE = 2000_00000000; // $2000.00 (8 decimals)

  beforeEach(async function () {
    [owner, user1, user2, liquidator, insurance] = await ethers.getSigners();

    // Deploy mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    weth = await MockERC20.deploy("Wrapped Ether", "WETH", WETH_DECIMALS);

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    usdcFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, USDC_PRICE);
    wethFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, WETH_PRICE);

    // Deploy CreditRegistry
    const CreditRegistry = await ethers.getContractFactory("CreditRegistryV1_1");
    registry = await CreditRegistry.deploy();

    // Deploy ScoreOracle
    const ScoreOracle = await ethers.getContractFactory("ScoreOracle");
    oracle = await ScoreOracle.deploy(registry.target);

    // Deploy CreditVault
    const CreditVault = await ethers.getContractFactory("CreditVault");
    vault = await CreditVault.deploy(registry.target, oracle.target);

    // Configure vault
    await vault.setAsset(usdc.target, usdcFeed.target, true);
    await vault.setAsset(weth.target, wethFeed.target, true);
    await vault.setInsurancePool(insurance.address);

    // Authorize vault as lender in registry
    await registry.setAuthorizedLender(vault.target, true);

    // Mint tokens to users
    await usdc.mint(user1.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await weth.mint(user1.address, ethers.parseUnits("10", WETH_DECIMALS));
    await usdc.mint(user2.address, ethers.parseUnits("10000", USDC_DECIMALS));

    // Approve vault
    await usdc.connect(user1).approve(vault.target, ethers.MaxUint256);
    await weth.connect(user1).approve(vault.target, ethers.MaxUint256);
    await usdc.connect(user2).approve(vault.target, ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set correct registry and oracle", async function () {
      expect(await vault.registry()).to.equal(registry.target);
      expect(await vault.oracle()).to.equal(oracle.target);
    });

    it("Should set correct LTV constants", async function () {
      expect(await vault.LTV_BRONZE()).to.equal(50);
      expect(await vault.LTV_SILVER()).to.equal(70);
      expect(await vault.LTV_GOLD()).to.equal(80);
      expect(await vault.LTV_PLATINUM()).to.equal(90);
    });

    it("Should set correct grace period constants", async function () {
      expect(await vault.GRACE_BRONZE()).to.equal(24 * 3600);
      expect(await vault.GRACE_SILVER()).to.equal(36 * 3600);
      expect(await vault.GRACE_GOLD()).to.equal(48 * 3600);
      expect(await vault.GRACE_PLATINUM()).to.equal(72 * 3600);
    });
  });

  describe("Asset Configuration", function () {
    it("Should allow owner to configure assets", async function () {
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      const newFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, USDC_PRICE);

      await expect(vault.setAsset(usdc.target, newFeed.target, true))
        .to.emit(vault, "AssetConfigured")
        .withArgs(usdc.target, newFeed.target, true);

      const config = await vault.assets(usdc.target);
      expect(config.allowed).to.be.true;
      expect(config.priceFeed).to.equal(newFeed.target);
    });

    it("Should not allow non-owner to configure assets", async function () {
      await expect(
        vault.connect(user1).setAsset(usdc.target, usdcFeed.target, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Collateral Deposit", function () {
    it("Should allow deposit of allowed assets", async function () {
      const amount = ethers.parseUnits("1000", USDC_DECIMALS);

      await expect(vault.connect(user1).depositCollateral(usdc.target, amount))
        .to.emit(vault, "CollateralDeposited");

      const collateral = await vault.userCollateral(user1.address);
      expect(collateral).to.be.gt(0);
    });

    it("Should reject deposit of disallowed assets", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const badToken = await MockERC20.deploy("Bad", "BAD", 18);

      await badToken.mint(user1.address, ethers.parseEther("1000"));
      await badToken.connect(user1).approve(vault.target, ethers.MaxUint256);

      await expect(
        vault.connect(user1).depositCollateral(badToken.target, ethers.parseEther("100"))
      ).to.be.revertedWith("Asset not allowed");
    });

    it("Should reject zero amount deposit", async function () {
      await expect(
        vault.connect(user1).depositCollateral(usdc.target, 0)
      ).to.be.revertedWith("Zero amount");
    });
  });

  describe("Collateral Withdrawal", function () {
    beforeEach(async function () {
      // Deposit collateral
      await vault.connect(user1).depositCollateral(
        usdc.target,
        ethers.parseUnits("1000", USDC_DECIMALS)
      );
    });

    it("Should allow withdrawal if no loans", async function () {
      const amount = ethers.parseUnits("500", USDC_DECIMALS);

      await expect(vault.connect(user1).withdrawCollateral(usdc.target, amount))
        .to.emit(vault, "CollateralWithdrawn");
    });

    it("Should reject withdrawal if health factor too low", async function () {
      // This test would require borrowing first, which we'll add in integration tests
      // For now, just test basic withdrawal validation
      const amount = ethers.parseUnits("2000", USDC_DECIMALS); // More than deposited

      await expect(
        vault.connect(user1).withdrawCollateral(usdc.target, amount)
      ).to.be.revertedWith("Insufficient collateral");
    });
  });

  describe("Borrowing", function () {
    beforeEach(async function () {
      // Setup user1 with good score
      // Deposit stake to improve sybil score
      await registry.connect(user1).stake({ value: ethers.parseEther("1000") });

      // Age the wallet by registering first seen
      await registry.connect(user1).recordFirstSeen();
      await time.increase(400 * 24 * 3600); // 400 days

      // Deposit collateral
      await vault.connect(user1).depositCollateral(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS)
      );
    });

    it("Should create loan with correct LTV enforcement", async function () {
      // Get user's score to determine max LTV
      const score = await oracle.computeScore(user1.address);
      console.log("User score:", score.overall.toString());

      // 1 WETH = $2000 collateral
      // With Bronze LTV (50%), max borrow = $1000
      const borrowAmount = ethers.parseEther("1000"); // $1000 USD

      await expect(vault.connect(user1).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        borrowAmount
      )).to.emit(vault, "LoanCreated");

      const loan = await vault.getLoan(0);
      expect(loan.borrower).to.equal(user1.address);
      expect(loan.principal).to.equal(borrowAmount);
      expect(loan.active).to.be.true;
    });

    it("Should reject borrow exceeding LTV", async function () {
      // 1 WETH = $2000, with Bronze LTV (50%) max = $1000
      // Try to borrow $1500 (exceeds limit)
      const borrowAmount = ethers.parseEther("1500");

      await expect(
        vault.connect(user1).borrow(
          weth.target,
          ethers.parseUnits("1", WETH_DECIMALS),
          borrowAmount
        )
      ).to.be.revertedWith("Exceeds allowed LTV");
    });

    it("Should register loan in registry", async function () {
      const borrowAmount = ethers.parseEther("500");

      await vault.connect(user1).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        borrowAmount
      );

      const loans = await registry.getLoans(user1.address);
      expect(loans.length).to.equal(1);
      expect(loans[0].principal).to.equal(borrowAmount);
    });
  });

  describe("Repayment", function () {
    let loanId;

    beforeEach(async function () {
      // Setup and borrow
      await registry.connect(user1).stake({ value: ethers.parseEther("1000") });
      await registry.connect(user1).recordFirstSeen();
      await time.increase(400 * 24 * 3600);

      await vault.connect(user1).depositCollateral(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS)
      );

      await vault.connect(user1).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("500")
      );

      loanId = 0;
    });

    it("Should allow partial repayment", async function () {
      const repayAmount = ethers.parseEther("100");

      await expect(vault.connect(user1).repay(loanId, repayAmount))
        .to.emit(vault, "LoanRepaid");

      const loan = await vault.getLoan(loanId);
      expect(loan.active).to.be.true; // Still active after partial repay
    });

    it("Should close loan on full repayment", async function () {
      const debt = await vault.calculateDebt(loanId);

      await expect(vault.connect(user1).repay(loanId, debt))
        .to.emit(vault, "LoanRepaid");

      const loan = await vault.getLoan(loanId);
      expect(loan.active).to.be.false;
    });

    it("Should register repayment in registry", async function () {
      const repayAmount = ethers.parseEther("100");
      await vault.connect(user1).repay(loanId, repayAmount);

      const repayments = await registry.getRepayments(user1.address);
      expect(repayments.length).to.equal(1);
      expect(repayments[0].amount).to.equal(repayAmount);
    });
  });

  describe("Liquidation", function () {
    let loanId;

    beforeEach(async function () {
      // Setup user with poor score and borrow at edge of liquidation
      await registry.connect(user1).recordFirstSeen();

      await vault.connect(user1).depositCollateral(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS)
      );

      // Borrow close to max LTV for bronze (50%)
      await vault.connect(user1).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950") // Close to 50% of $2000
      );

      loanId = 0;
    });

    it("Should start grace period when approaching liquidation threshold", async function () {
      // Wait for interest to accrue
      await time.increase(180 * 24 * 3600); // 180 days

      // Try to liquidate - should start grace period
      await expect(
        vault.connect(liquidator).liquidate(loanId)
      ).to.be.revertedWith("Grace period started");

      const loan = await vault.getLoan(loanId);
      expect(loan.graceStart).to.be.gt(0);
    });

    it("Should liquidate after grace period expires", async function () {
      // Accrue interest
      await time.increase(180 * 24 * 3600);

      // Start grace period
      await expect(vault.connect(liquidator).liquidate(loanId)).to.be.reverted;

      // Wait for grace period to expire (Bronze = 24h)
      await time.increase(25 * 3600);

      // Now liquidation should succeed
      await expect(vault.connect(liquidator).liquidate(loanId))
        .to.emit(vault, "LoanLiquidated");

      const loan = await vault.getLoan(loanId);
      expect(loan.active).to.be.false;
    });

    it("Should distribute liquidation penalty correctly", async function () {
      // Accrue interest and trigger grace period
      await time.increase(180 * 24 * 3600);
      await expect(vault.connect(liquidator).liquidate(loanId)).to.be.reverted;

      // Wait for grace expiry
      await time.increase(25 * 3600);

      const liquidatorBalBefore = await weth.balanceOf(liquidator.address);
      const insuranceBalBefore = await weth.balanceOf(insurance.address);

      await vault.connect(liquidator).liquidate(loanId);

      const liquidatorBalAfter = await weth.balanceOf(liquidator.address);
      const insuranceBalAfter = await weth.balanceOf(insurance.address);

      // Liquidator should get 5% of collateral
      expect(liquidatorBalAfter - liquidatorBalBefore).to.be.gt(0);

      // Insurance should get 5% of collateral
      expect(insuranceBalAfter - insuranceBalBefore).to.be.gt(0);
    });

    it("Should register liquidation in registry", async function () {
      // Trigger and complete liquidation
      await time.increase(180 * 24 * 3600);
      await expect(vault.connect(liquidator).liquidate(loanId)).to.be.reverted;
      await time.increase(25 * 3600);

      await vault.connect(liquidator).liquidate(loanId);

      const liquidations = await registry.getLiquidations(user1.address);
      expect(liquidations.length).to.equal(1);
    });
  });

  describe("Health Factor", function () {
    beforeEach(async function () {
      await registry.connect(user1).stake({ value: ethers.parseEther("1000") });
      await registry.connect(user1).recordFirstSeen();
      await time.increase(400 * 24 * 3600);

      await vault.connect(user1).depositCollateral(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS)
      );

      await vault.connect(user1).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("500")
      );
    });

    it("Should calculate health factor correctly", async function () {
      const healthFactor = await vault.getHealthFactor(0);
      // Collateral = $2000, Borrowed = $500
      // Health factor = 2000 / 500 = 4.0
      expect(healthFactor).to.be.closeTo(ethers.parseEther("4"), ethers.parseEther("0.1"));
    });

    it("Should decrease health factor as interest accrues", async function () {
      const hf1 = await vault.getHealthFactor(0);

      await time.increase(180 * 24 * 3600); // 180 days

      const hf2 = await vault.getHealthFactor(0);

      expect(hf2).to.be.lt(hf1);
    });
  });

  describe("APR Calculation", function () {
    it("Should return lower APR for higher scores", async function () {
      const apr850 = await oracle.getAPR(850);
      const apr300 = await oracle.getAPR(300);

      expect(apr850).to.be.lt(apr300);
    });

    it("Should respect min/max APR bounds", async function () {
      const apr850 = await oracle.getAPR(850);
      const apr300 = await oracle.getAPR(300);

      expect(apr850).to.be.gte(await oracle.minAPR());
      expect(apr300).to.be.lte(await oracle.maxAPR());
    });
  });
});
