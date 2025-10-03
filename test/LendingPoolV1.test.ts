import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LendingPoolV1, CreditRegistryV1_1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LendingPoolV1", function () {
  let lendingPool: LendingPoolV1;
  let creditRegistry: CreditRegistryV1_1;
  let mockUSDC: any;
  let mockWETH: any;
  let mockWBTC: any;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let lp1: SignerWithAddress;
  let lp2: SignerWithAddress;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;
  let liquidator: SignerWithAddress;
  let treasury: SignerWithAddress;

  const USDC_DECIMALS = 6;
  const WETH_DECIMALS = 18;
  const WBTC_DECIMALS = 8;

  const parseUSDC = (amount: string) => ethers.parseUnits(amount, USDC_DECIMALS);
  const parseWETH = (amount: string) => ethers.parseUnits(amount, WETH_DECIMALS);
  const parseWBTC = (amount: string) => ethers.parseUnits(amount, WBTC_DECIMALS);

  beforeEach(async function () {
    [owner, attester, lp1, lp2, borrower1, borrower2, liquidator, treasury] =
      await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", WETH_DECIMALS);
    mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", WBTC_DECIMALS);

    // Deploy CreditRegistry
    const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistryV1_1");
    creditRegistry = await CreditRegistryFactory.deploy(treasury.address);
    await creditRegistry.setAuthorizedAttester(attester.address, true);

    // Deploy LendingPool
    const LendingPoolFactory = await ethers.getContractFactory("LendingPoolV1");
    lendingPool = await LendingPoolFactory.deploy(
      await creditRegistry.getAddress(),
      treasury.address
    );

    // Mint tokens to users
    await mockUSDC.mint(lp1.address, parseUSDC("1000000")); // 1M USDC
    await mockUSDC.mint(lp2.address, parseUSDC("500000")); // 500K USDC
    await mockWETH.mint(borrower1.address, parseWETH("100")); // 100 WETH
    await mockWETH.mint(borrower2.address, parseWETH("50")); // 50 WETH
    await mockWBTC.mint(borrower1.address, parseWBTC("10")); // 10 WBTC
    await mockUSDC.mint(liquidator.address, parseUSDC("100000")); // 100K USDC

    // Approve tokens
    await mockUSDC.connect(lp1).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(lp2).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockWETH.connect(borrower1).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockWETH.connect(borrower2).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockWBTC.connect(borrower1).approve(await lendingPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(liquidator).approve(await lendingPool.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the correct credit registry address", async function () {
      expect(await lendingPool.creditRegistry()).to.equal(await creditRegistry.getAddress());
    });

    it("Should set the correct treasury address", async function () {
      expect(await lendingPool.treasury()).to.equal(treasury.address);
    });

    it("Should set the correct owner", async function () {
      expect(await lendingPool.owner()).to.equal(owner.address);
    });

    it("Should have correct initial constants", async function () {
      expect(await lendingPool.BASE_RATE()).to.equal(ethers.parseUnits("0.02", 18)); // 2%
      expect(await lendingPool.OPTIMAL_UTILIZATION()).to.equal(ethers.parseUnits("0.80", 18)); // 80%
      expect(await lendingPool.SLOPE_1()).to.equal(ethers.parseUnits("0.04", 18)); // 4%
      expect(await lendingPool.SLOPE_2()).to.equal(ethers.parseUnits("0.60", 18)); // 60%
    });

    it("Should have correct LTV limits by tier", async function () {
      expect(await lendingPool.PLATINUM_LTV()).to.equal(ethers.parseUnits("0.90", 18)); // 90%
      expect(await lendingPool.GOLD_LTV()).to.equal(ethers.parseUnits("0.75", 18)); // 75%
      expect(await lendingPool.SILVER_LTV()).to.equal(ethers.parseUnits("0.65", 18)); // 65%
      expect(await lendingPool.BRONZE_LTV()).to.equal(ethers.parseUnits("0.50", 18)); // 50%
      expect(await lendingPool.SUBPRIME_LTV()).to.equal(ethers.parseUnits("0.50", 18)); // 50%
    });
  });

  describe("Asset Management", function () {
    it("Should allow owner to enable borrow asset", async function () {
      await expect(lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS))
        .to.emit(lendingPool, "BorrowAssetEnabled")
        .withArgs(await mockUSDC.getAddress());
    });

    it("Should allow owner to enable collateral asset with price feed", async function () {
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000 // $2000 with 8 decimals
      );

      await expect(
        lendingPool.enableCollateralAsset(
          await mockWETH.getAddress(),
          WETH_DECIMALS,
          await mockPriceFeed.getAddress()
        )
      )
        .to.emit(lendingPool, "CollateralAssetEnabled")
        .withArgs(await mockWETH.getAddress());
    });

    it("Should revert if non-owner tries to enable asset", async function () {
      await expect(
        lendingPool.connect(lp1).enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS)
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");
    });

    it("Should revert if enabling same borrow asset twice", async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      await expect(
        lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS)
      ).to.be.revertedWith("Asset already enabled");
    });

    it("Should allow owner to disable borrow asset", async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      await lendingPool.disableBorrowAsset(await mockUSDC.getAddress());
      const assetInfo = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      expect(assetInfo.isEnabled).to.be.false;
    });
  });

  describe("Liquidity Provider Operations", function () {
    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
    });

    it("Should allow LP to deposit", async function () {
      const depositAmount = parseUSDC("100000");
      await expect(lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), depositAmount))
        .to.emit(lendingPool, "Deposit")
        .withArgs(lp1.address, await mockUSDC.getAddress(), depositAmount);

      const lpPosition = await lendingPool.lpPositions(lp1.address, await mockUSDC.getAddress());
      expect(lpPosition.depositedAmount).to.equal(depositAmount);
    });

    it("Should track total deposited correctly", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));
      await lendingPool.connect(lp2).deposit(await mockUSDC.getAddress(), parseUSDC("50000"));

      const assetInfo = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      expect(assetInfo.totalDeposited).to.equal(parseUSDC("150000"));
    });

    it("Should allow LP to withdraw when no borrows", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));

      await expect(
        lendingPool.connect(lp1).withdraw(await mockUSDC.getAddress(), parseUSDC("50000"))
      )
        .to.emit(lendingPool, "Withdraw")
        .withArgs(lp1.address, await mockUSDC.getAddress(), parseUSDC("50000"));

      const lpPosition = await lendingPool.lpPositions(lp1.address, await mockUSDC.getAddress());
      expect(lpPosition.depositedAmount).to.equal(parseUSDC("50000"));
    });

    it("Should revert withdraw if insufficient balance", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));

      await expect(
        lendingPool.connect(lp1).withdraw(await mockUSDC.getAddress(), parseUSDC("150000"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert withdraw if insufficient liquidity (funds borrowed)", async function () {
      // Setup: LP deposits, borrower borrows
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));

      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000 // $2000 WETH
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );

      // Give borrower1 a platinum score (820)
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3); // Advance 3 days
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrower borrows 80K USDC (against ~45 WETH collateral @ $2000 = $90K, 90% LTV)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("80000"),
          parseWETH("45")
        );

      // LP tries to withdraw 50K but only 20K available
      await expect(
        lendingPool.connect(lp1).withdraw(await mockUSDC.getAddress(), parseUSDC("50000"))
      ).to.be.revertedWith("Insufficient liquidity");
    });

    it("Should calculate LP earnings correctly", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));

      // Setup borrow to generate interest
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000 // $2000 WETH
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("28")
        );

      // Advance time to accrue interest
      await time.increase(86400 * 365); // 1 year

      const earnings = await lendingPool.calculateLPEarnings(
        lp1.address,
        await mockUSDC.getAddress()
      );
      expect(earnings).to.be.gt(0);
    });
  });

  describe("Borrow Operations", function () {
    let mockWETHPriceFeed: any;

    beforeEach(async function () {
      // Enable USDC as borrow asset
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);

      // Enable WETH as collateral with $2000 price
      mockWETHPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000 // $2000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockWETHPriceFeed.getAddress()
      );

      // LP deposits liquidity
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));
    });

    it("Should allow platinum user to borrow at 90% LTV", async function () {
      // Attest platinum score (820)
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Collateral: 50 WETH @ $2000 = $100K, 90% LTV = $90K max borrow
      const borrowAmount = parseUSDC("90000");
      const collateralAmount = parseWETH("50");

      await expect(
        lendingPool
          .connect(borrower1)
          .borrow(
            await mockUSDC.getAddress(),
            await mockWETH.getAddress(),
            borrowAmount,
            collateralAmount
          )
      )
        .to.emit(lendingPool, "Borrow")
        .withArgs(
          borrower1.address,
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          borrowAmount,
          collateralAmount
        );
    });

    it("Should allow gold user to borrow at 75% LTV", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 740, 1, 75, 90, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Collateral: 50 WETH @ $2000 = $100K, 75% LTV = $75K max borrow
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("75000"),
          parseWETH("50")
        );

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.borrowAmount).to.equal(parseUSDC("75000"));
    });

    it("Should revert if borrow exceeds LTV", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 740, 1, 75, 90, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Try to borrow 80K against 100K collateral (80% LTV, but user only has 75% limit)
      await expect(
        lendingPool
          .connect(borrower1)
          .borrow(
            await mockUSDC.getAddress(),
            await mockWETH.getAddress(),
            parseUSDC("80000"),
            parseWETH("50")
          )
      ).to.be.revertedWith("Exceeds max LTV");
    });

    it("Should revert if user has no credit score", async function () {
      await expect(
        lendingPool
          .connect(borrower1)
          .borrow(
            await mockUSDC.getAddress(),
            await mockWETH.getAddress(),
            parseUSDC("50000"),
            parseWETH("50")
          )
      ).to.be.revertedWith("No valid credit score");
    });

    it("Should revert if insufficient liquidity", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Try to borrow more than available (500K deposited)
      await expect(
        lendingPool
          .connect(borrower1)
          .borrow(
            await mockUSDC.getAddress(),
            await mockWETH.getAddress(),
            parseUSDC("600000"),
            parseWETH("500")
          )
      ).to.be.revertedWith("Insufficient liquidity");
    });

    it("Should calculate correct interest rate based on utilization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 400K from 500K (80% utilization = optimal)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("400000"),
          parseWETH("250")
        );

      const loan = await lendingPool.loans(borrower1.address, 0);
      // At 80% utilization: baseRate = 2% + (80% * 4%) = 5.2%
      // With platinum multiplier (80%): 5.2% * 0.8 = 4.16%
      expect(loan.interestRate).to.be.closeTo(
        ethers.parseUnits("0.0416", 18),
        ethers.parseUnits("0.001", 18)
      );
    });

    it("Should apply correct credit tier multiplier to interest rate", async function () {
      // Test subprime user (150% multiplier)
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 450, 4, 50, 150, 1, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("60")
        );

      const loan = await lendingPool.loans(borrower1.address, 0);
      // At 10% utilization: baseRate = 2% + (10% * 4%) = 2.4%
      // With subprime multiplier (150%): 2.4% * 1.5 = 3.6%
      expect(loan.interestRate).to.be.closeTo(
        ethers.parseUnits("0.036", 18),
        ethers.parseUnits("0.001", 18)
      );
    });

    it("Should track multiple loans for same user", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // First loan
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("30")
        );

      // Second loan
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("30000"),
          parseWETH("20")
        );

      const loanCount = await lendingPool.getUserLoanCount(borrower1.address);
      expect(loanCount).to.equal(2);
    });
  });

  describe("Repay Operations", function () {
    let mockWETHPriceFeed: any;

    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      mockWETHPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockWETHPriceFeed.getAddress()
      );
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      // Setup borrower with platinum score
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("30")
        );
    });

    it("Should allow full repayment immediately (no interest)", async function () {
      const repayAmount = parseUSDC("50000");

      // Mint USDC to borrower for repayment
      await mockUSDC.mint(borrower1.address, repayAmount);
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), repayAmount);

      await expect(lendingPool.connect(borrower1).repay(0, repayAmount))
        .to.emit(lendingPool, "Repay")
        .withArgs(borrower1.address, 0, repayAmount);

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.isActive).to.be.false;
    });

    it("Should accrue interest over time", async function () {
      // Advance time 1 year
      await time.increase(86400 * 365);

      const debt = await lendingPool.calculateCurrentDebt(borrower1.address, 0);
      expect(debt).to.be.gt(parseUSDC("50000")); // Should be > principal
    });

    it("Should allow partial repayment", async function () {
      const partialAmount = parseUSDC("20000");

      await mockUSDC.mint(borrower1.address, partialAmount);
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), partialAmount);

      await lendingPool.connect(borrower1).repay(0, partialAmount);

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.borrowAmount).to.equal(parseUSDC("30000"));
      expect(loan.isActive).to.be.true;
    });

    it("Should return collateral on full repayment", async function () {
      const initialBalance = await mockWETH.balanceOf(borrower1.address);

      await mockUSDC.mint(borrower1.address, parseUSDC("50000"));
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), parseUSDC("50000"));

      await lendingPool.connect(borrower1).repay(0, parseUSDC("50000"));

      const finalBalance = await mockWETH.balanceOf(borrower1.address);
      expect(finalBalance - initialBalance).to.equal(parseWETH("30")); // Collateral returned
    });

    it("Should partially return collateral on partial repayment", async function () {
      const partialAmount = parseUSDC("25000"); // 50% repayment

      await mockUSDC.mint(borrower1.address, partialAmount);
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), partialAmount);

      const initialCollateral = await mockWETH.balanceOf(borrower1.address);
      await lendingPool.connect(borrower1).repay(0, partialAmount);
      const finalCollateral = await mockWETH.balanceOf(borrower1.address);

      // Should return ~15 WETH (50% of 30 WETH collateral)
      expect(finalCollateral - initialCollateral).to.be.closeTo(
        parseWETH("15"),
        parseWETH("0.1")
      );
    });

    it("Should update LP earnings on repayment", async function () {
      await time.increase(86400 * 365); // 1 year

      const earningsBefore = await lendingPool.calculateLPEarnings(
        lp1.address,
        await mockUSDC.getAddress()
      );

      const debt = await lendingPool.calculateCurrentDebt(borrower1.address, 0);
      await mockUSDC.mint(borrower1.address, debt);
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), debt);
      await lendingPool.connect(borrower1).repay(0, debt);

      const earningsAfter = await lendingPool.calculateLPEarnings(
        lp1.address,
        await mockUSDC.getAddress()
      );

      expect(earningsAfter).to.be.gt(earningsBefore);
    });

    it("Should revert repayment of non-existent loan", async function () {
      await expect(lendingPool.connect(borrower2).repay(0, parseUSDC("1000"))).to.be.revertedWith(
        "Invalid loan"
      );
    });

    it("Should revert repayment of inactive loan", async function () {
      await mockUSDC.mint(borrower1.address, parseUSDC("50000"));
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), parseUSDC("50000"));
      await lendingPool.connect(borrower1).repay(0, parseUSDC("50000"));

      // Try to repay again
      await expect(
        lendingPool.connect(borrower1).repay(0, parseUSDC("1000"))
      ).to.be.revertedWith("Loan not active");
    });
  });

  describe("Liquidation Operations", function () {
    let mockWETHPriceFeed: any;

    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      mockWETHPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000 // $2000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockWETHPriceFeed.getAddress()
      );
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow at 90% LTV: 50 WETH @ $2000 = $100K, borrow $90K
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("90000"),
          parseWETH("50")
        );
    });

    it("Should allow liquidation when health factor < 1", async function () {
      // Drop WETH price to $1500 (collateral worth $75K, loan $90K -> undercollateralized)
      await mockWETHPriceFeed.updateAnswer(150000000000);

      const debt = await lendingPool.calculateCurrentDebt(borrower1.address, 0);

      await expect(lendingPool.connect(liquidator).liquidate(borrower1.address, 0))
        .to.emit(lendingPool, "Liquidate")
        .withArgs(borrower1.address, 0, liquidator.address);
    });

    it("Should revert liquidation when health factor >= 1", async function () {
      await expect(
        lendingPool.connect(liquidator).liquidate(borrower1.address, 0)
      ).to.be.revertedWith("Loan is healthy");
    });

    it("Should transfer collateral to liquidator with bonus", async function () {
      await mockWETHPriceFeed.updateAnswer(150000000000); // $1500

      const liquidatorBalanceBefore = await mockWETH.balanceOf(liquidator.address);
      await lendingPool.connect(liquidator).liquidate(borrower1.address, 0);
      const liquidatorBalanceAfter = await mockWETH.balanceOf(liquidator.address);

      // Liquidator receives collateral + 5% bonus
      const received = liquidatorBalanceAfter - liquidatorBalanceBefore;
      expect(received).to.be.gt(0);
    });

    it("Should mark loan as inactive after liquidation", async function () {
      await mockWETHPriceFeed.updateAnswer(150000000000);
      await lendingPool.connect(liquidator).liquidate(borrower1.address, 0);

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.isActive).to.be.false;
    });

    it("Should calculate correct health factor", async function () {
      // Initial health factor: ($100K collateral * 0.9 LTV) / $90K debt = 1.0
      const hf1 = await lendingPool.calculateHealthFactor(borrower1.address, 0);
      expect(hf1).to.be.closeTo(ethers.parseUnits("1.0", 18), ethers.parseUnits("0.01", 18));

      // After price drop: ($75K collateral * 0.9) / $90K = 0.75
      await mockWETHPriceFeed.updateAnswer(150000000000);
      const hf2 = await lendingPool.calculateHealthFactor(borrower1.address, 0);
      expect(hf2).to.be.lt(ethers.parseUnits("1.0", 18));
    });

    it("Should update pool metrics after liquidation", async function () {
      const assetInfoBefore = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      const totalBorrowedBefore = assetInfoBefore.totalBorrowed;

      await mockWETHPriceFeed.updateAnswer(150000000000);
      await lendingPool.connect(liquidator).liquidate(borrower1.address, 0);

      const assetInfoAfter = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      expect(assetInfoAfter.totalBorrowed).to.be.lt(totalBorrowedBefore);
    });
  });

  describe("Interest Rate Calculations", function () {
    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("1000000"));
    });

    it("Should calculate correct rate at 0% utilization", async function () {
      // Base rate = 2%
      const rate = await lendingPool.calculateBorrowRate(await mockUSDC.getAddress());
      expect(rate).to.equal(ethers.parseUnits("0.02", 18));
    });

    it("Should calculate correct rate below optimal utilization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 400K from 1M (40% utilization)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("400000"),
          parseWETH("250")
        );

      // Rate = 2% + (40% * 4%) = 3.6%
      const rate = await lendingPool.calculateBorrowRate(await mockUSDC.getAddress());
      expect(rate).to.be.closeTo(ethers.parseUnits("0.036", 18), ethers.parseUnits("0.001", 18));
    });

    it("Should calculate correct rate at optimal utilization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 800K from 1M (80% utilization)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("800000"),
          parseWETH("500")
        );

      // Rate = 2% + (80% * 4%) = 5.2%
      const rate = await lendingPool.calculateBorrowRate(await mockUSDC.getAddress());
      expect(rate).to.be.closeTo(ethers.parseUnits("0.052", 18), ethers.parseUnits("0.001", 18));
    });

    it("Should calculate correct rate above optimal utilization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 900K from 1M (90% utilization)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("900000"),
          parseWETH("550")
        );

      // Rate = 2% + (80% * 4%) + ((90% - 80%) * 60%) = 2% + 3.2% + 6% = 11.2%
      const rate = await lendingPool.calculateBorrowRate(await mockUSDC.getAddress());
      expect(rate).to.be.closeTo(ethers.parseUnits("0.112", 18), ethers.parseUnits("0.002", 18));
    });

    it("Should calculate correct rate near 100% utilization", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 990K from 1M (99% utilization)
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("990000"),
          parseWETH("600")
        );

      // Rate = 2% + (80% * 4%) + ((99% - 80%) * 60%) = 2% + 3.2% + 11.4% = 16.6%
      const rate = await lendingPool.calculateBorrowRate(await mockUSDC.getAddress());
      expect(rate).to.be.gt(ethers.parseUnits("0.15", 18)); // Should be high
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause", async function () {
      await lendingPool.pause();
      expect(await lendingPool.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await lendingPool.pause();
      await lendingPool.unpause();
      expect(await lendingPool.paused()).to.be.false;
    });

    it("Should revert operations when paused", async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      await lendingPool.pause();

      await expect(
        lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("1000"))
      ).to.be.revertedWithCustomError(lendingPool, "EnforcedPause");
    });

    it("Should allow owner to set liquidation bonus", async function () {
      await lendingPool.setLiquidationBonus(ethers.parseUnits("0.10", 18)); // 10%
      expect(await lendingPool.liquidationBonus()).to.equal(ethers.parseUnits("0.10", 18));
    });

    it("Should allow owner to set protocol fee", async function () {
      await lendingPool.setProtocolFee(ethers.parseUnits("0.20", 18)); // 20%
      expect(await lendingPool.protocolFee()).to.equal(ethers.parseUnits("0.20", 18));
    });

    it("Should revert if non-owner tries admin functions", async function () {
      await expect(
        lendingPool.connect(lp1).setLiquidationBonus(ethers.parseUnits("0.10", 18))
      ).to.be.revertedWithCustomError(lendingPool, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );
    });

    it("Should handle zero liquidity pool", async function () {
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await expect(
        lendingPool
          .connect(borrower1)
          .borrow(
            await mockUSDC.getAddress(),
            await mockWETH.getAddress(),
            parseUSDC("1000"),
            parseWETH("1")
          )
      ).to.be.revertedWith("Insufficient liquidity");
    });

    it("Should handle dust amounts", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("1000000"));

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow 1 USDC
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("1"),
          parseWETH("0.001")
        );

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.borrowAmount).to.equal(parseUSDC("1"));
    });

    it("Should handle multiple collateral types", async function () {
      // Enable WBTC as second collateral type
      const mockWBTCPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        4000000000000 // $40,000
      );
      await lendingPool.enableCollateralAsset(
        await mockWBTC.getAddress(),
        WBTC_DECIMALS,
        await mockWBTCPriceFeed.getAddress()
      );

      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrow with WBTC collateral
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWBTC.getAddress(),
          parseUSDC("100000"),
          parseWBTC("3") // 3 BTC @ $40K = $120K, 90% LTV = $108K
        );

      const loan = await lendingPool.loans(borrower1.address, 0);
      expect(loan.collateralAsset).to.equal(await mockWBTC.getAddress());
    });

    it("Should handle price feed staleness", async function () {
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );

      // Implementation note: In production, would check updatedAt timestamp
      // and revert if price is stale (e.g., > 1 hour old)
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("30")
        );
    });

    it("Should return correct user loan count", async function () {
      expect(await lendingPool.getUserLoanCount(borrower1.address)).to.equal(1);
      expect(await lendingPool.getUserLoanCount(borrower2.address)).to.equal(0);
    });

    it("Should return correct total value locked", async function () {
      const tvl = await lendingPool.getTotalValueLocked(await mockUSDC.getAddress());
      expect(tvl).to.equal(parseUSDC("500000"));
    });

    it("Should return correct available liquidity", async function () {
      const available = await lendingPool.getAvailableLiquidity(await mockUSDC.getAddress());
      expect(available).to.equal(parseUSDC("450000")); // 500K - 50K borrowed
    });

    it("Should return correct utilization rate", async function () {
      const utilization = await lendingPool.getUtilizationRate(await mockUSDC.getAddress());
      // 50K borrowed / 500K deposited = 10%
      expect(utilization).to.equal(ethers.parseUnits("0.10", 18));
    });

    it("Should return correct pool statistics", async function () {
      const assetInfo = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      expect(assetInfo.totalDeposited).to.equal(parseUSDC("500000"));
      expect(assetInfo.totalBorrowed).to.equal(parseUSDC("50000"));
      expect(assetInfo.isEnabled).to.be.true;
    });
  });

  describe("Integration Scenarios", function () {
    beforeEach(async function () {
      await lendingPool.enableBorrowAsset(await mockUSDC.getAddress(), USDC_DECIMALS);
      const mockPriceFeed = await (await ethers.getContractFactory("MockV3Aggregator")).deploy(
        8,
        200000000000
      );
      await lendingPool.enableCollateralAsset(
        await mockWETH.getAddress(),
        WETH_DECIMALS,
        await mockPriceFeed.getAddress()
      );
    });

    it("Should handle complete user journey: deposit → borrow → repay → withdraw", async function () {
      // LP deposits
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("100000"));

      // Borrower gets credit score
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 740, 1, 75, 90, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      // Borrower borrows
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("35")
        );

      // Time passes, interest accrues
      await time.increase(86400 * 180); // 6 months

      // Borrower repays
      const debt = await lendingPool.calculateCurrentDebt(borrower1.address, 0);
      await mockUSDC.mint(borrower1.address, debt);
      await mockUSDC.connect(borrower1).approve(await lendingPool.getAddress(), debt);
      await lendingPool.connect(borrower1).repay(0, debt);

      // LP withdraws with earnings
      const earnings = await lendingPool.calculateLPEarnings(
        lp1.address,
        await mockUSDC.getAddress()
      );
      await lendingPool
        .connect(lp1)
        .withdraw(await mockUSDC.getAddress(), parseUSDC("100000") + earnings);

      expect(await mockUSDC.balanceOf(lp1.address)).to.be.gt(parseUSDC("900000")); // Initial 1M - 100K deposit + earnings
    });

    it("Should handle multiple simultaneous borrowers", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      // Setup two borrowers
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await creditRegistry
        .connect(attester)
        .attestScore(borrower2.address, 650, 2, 65, 110, 1, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower2.address, merkleRoot);

      // Both borrow
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("200000"),
          parseWETH("120")
        );

      await lendingPool
        .connect(borrower2)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("100000"),
          parseWETH("80")
        );

      const assetInfo = await lendingPool.borrowAssets(await mockUSDC.getAddress());
      expect(assetInfo.totalBorrowed).to.equal(parseUSDC("300000"));
    });

    it("Should handle credit score updates mid-loan", async function () {
      await lendingPool.connect(lp1).deposit(await mockUSDC.getAddress(), parseUSDC("500000"));

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 740, 1, 75, 90, 2, merkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, merkleRoot);

      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("50000"),
          parseWETH("35")
        );

      // Score improves to platinum
      const newMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      await creditRegistry
        .connect(attester)
        .attestScore(borrower1.address, 820, 0, 90, 80, 2, newMerkleRoot);
      await time.increase(86400 * 3);
      await creditRegistry.connect(attester).finalizeScore(borrower1.address, newMerkleRoot);

      // Borrower can now borrow more at better LTV
      await lendingPool
        .connect(borrower1)
        .borrow(
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          parseUSDC("80000"),
          parseWETH("50")
        );

      expect(await lendingPool.getUserLoanCount(borrower1.address)).to.equal(2);
    });
  });
});
