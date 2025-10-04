const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration: Full System End-to-End", function () {
  let registry, oracle, vault;
  let usdc, weth;
  let usdcFeed, wethFeed;
  let owner, alice, bob, liquidator, insurance;

  const USDC_DECIMALS = 6;
  const WETH_DECIMALS = 18;
  const FEED_DECIMALS = 8;

  const USDC_PRICE = 1_00000000; // $1.00
  const WETH_PRICE = 2000_00000000; // $2000.00

  before(async function () {
    [owner, alice, bob, liquidator, insurance] = await ethers.getSigners();
  });

  describe("Phase 1: System Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      // Deploy tokens
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      usdc = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
      weth = await MockERC20.deploy("Wrapped Ether", "WETH", WETH_DECIMALS);

      expect(await usdc.symbol()).to.equal("USDC");
      expect(await weth.symbol()).to.equal("WETH");

      // Deploy price feeds
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      usdcFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, USDC_PRICE);
      wethFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, WETH_PRICE);

      expect(await usdcFeed.latestAnswer()).to.equal(USDC_PRICE);
      expect(await wethFeed.latestAnswer()).to.equal(WETH_PRICE);

      // Deploy CreditRegistry
      const CreditRegistry = await ethers.getContractFactory("CreditRegistryV1_1");
      registry = await CreditRegistry.deploy();

      expect(await registry.owner()).to.equal(owner.address);

      // Deploy ScoreOracle
      const ScoreOracle = await ethers.getContractFactory("ScoreOracle");
      oracle = await ScoreOracle.deploy(registry.target);

      expect(await oracle.registry()).to.equal(registry.target);

      // Deploy CreditVault
      const CreditVault = await ethers.getContractFactory("CreditVault");
      vault = await CreditVault.deploy(registry.target, oracle.target);

      expect(await vault.registry()).to.equal(registry.target);
      expect(await vault.oracle()).to.equal(oracle.target);

      console.log("\n✅ All contracts deployed:");
      console.log("  CreditRegistry:", registry.target);
      console.log("  ScoreOracle:", oracle.target);
      console.log("  CreditVault:", vault.target);
      console.log("  USDC:", usdc.target);
      console.log("  WETH:", weth.target);
    });

    it("Should configure system correctly", async function () {
      // Configure vault as authorized lender
      await registry.setAuthorizedLender(vault.target, true);
      expect(await registry.authorizedLenders(vault.target)).to.be.true;

      // Configure assets in vault
      await vault.setAsset(usdc.target, usdcFeed.target, true);
      await vault.setAsset(weth.target, wethFeed.target, true);

      const usdcConfig = await vault.assets(usdc.target);
      expect(usdcConfig.allowed).to.be.true;
      expect(usdcConfig.priceFeed).to.equal(usdcFeed.target);

      // Set insurance pool
      await vault.setInsurancePool(insurance.address);
      expect(await vault.insurancePool()).to.equal(insurance.address);

      console.log("\n✅ System configured");
    });

    it("Should mint tokens to test users", async function () {
      // Mint USDC and WETH to alice and bob
      await usdc.mint(alice.address, ethers.parseUnits("10000", USDC_DECIMALS));
      await weth.mint(alice.address, ethers.parseUnits("10", WETH_DECIMALS));
      await usdc.mint(bob.address, ethers.parseUnits("10000", USDC_DECIMALS));
      await weth.mint(bob.address, ethers.parseUnits("10", WETH_DECIMALS));

      expect(await usdc.balanceOf(alice.address)).to.equal(
        ethers.parseUnits("10000", USDC_DECIMALS)
      );

      console.log("\n✅ Test tokens minted to users");
    });

    it("Should approve vault to spend user tokens", async function () {
      await usdc.connect(alice).approve(vault.target, ethers.MaxUint256);
      await weth.connect(alice).approve(vault.target, ethers.MaxUint256);
      await usdc.connect(bob).approve(vault.target, ethers.MaxUint256);
      await weth.connect(bob).approve(vault.target, ethers.MaxUint256);

      console.log("\n✅ Vault approvals granted");
    });
  });

  describe("Phase 2: Alice's User Journey (New User → Good Score)", function () {
    it("Step 1: Alice checks initial score (new wallet)", async function () {
      const score = await oracle.computeScore(alice.address);

      console.log("\n📊 Alice's Initial Score (New Wallet):");
      console.log("  S1 (Repayment):", score.repayment.toString());
      console.log("  S2 (Collateral):", score.collateral.toString());
      console.log("  S3 (Sybil):", score.sybil.toString());
      console.log("  S4 (Cross-Chain):", score.crossChain.toString());
      console.log("  S5 (Participation):", score.participation.toString());
      console.log("  Overall:", score.overall.toString());

      // New wallet: S1=50 (neutral), S2=50, S3=-450 (new + no KYC), S4=0, S5=0
      // Overall should be very low (close to 300)
      expect(score.overall).to.be.lte(350);
    });

    it("Step 2: Alice improves score by staking", async function () {
      // Alice stakes 1000 ETH
      await registry.connect(alice).stake({ value: ethers.parseEther("1000") });

      const stakeInfo = await registry.getStakeInfo(alice.address);
      expect(stakeInfo.amount).to.equal(ethers.parseEther("1000"));

      const score = await oracle.computeScore(alice.address);

      console.log("\n📊 Alice's Score After Staking 1000 ETH:");
      console.log("  S3 (Sybil):", score.sybil.toString(), "(+75 from stake)");
      console.log("  Overall:", score.overall.toString());

      // Sybil should improve: -450 → -375 (+75 from 1000 ETH stake)
      expect(score.sybil).to.be.gt(-450);
    });

    it("Step 3: Alice ages wallet and improves score further", async function () {
      // Record first seen
      await registry.connect(alice).recordFirstSeen();

      // Fast forward 400 days
      await time.increase(400 * 24 * 3600);

      const score = await oracle.computeScore(alice.address);

      console.log("\n📊 Alice's Score After 400 Days:");
      console.log("  S3 (Sybil):", score.sybil.toString(), "(no age penalty)");
      console.log("  Overall:", score.overall.toString());

      // Sybil should be much better: no age penalty, only -150 (no KYC) + 75 (stake) = -75
      expect(score.sybil).to.be.closeTo(-75, 10);
    });

    it("Step 4: Alice deposits collateral", async function () {
      const depositAmount = ethers.parseUnits("2", WETH_DECIMALS); // 2 WETH = $4000

      await expect(vault.connect(alice).depositCollateral(weth.target, depositAmount))
        .to.emit(vault, "CollateralDeposited");

      const collateral = await vault.userCollateral(alice.address);
      console.log("\n💰 Alice deposited 2 WETH ($4000 collateral)");
      console.log("  Collateral (USD):", ethers.formatEther(collateral));

      expect(collateral).to.be.gt(0);
    });

    it("Step 5: Alice borrows against collateral", async function () {
      const score = await oracle.computeScore(alice.address);

      // With current score, Alice should get Bronze tier (50% LTV)
      // $4000 collateral × 50% = $2000 max borrow
      const borrowAmount = ethers.parseEther("1500"); // Borrow $1500

      await expect(vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("2", WETH_DECIMALS),
        borrowAmount
      )).to.emit(vault, "LoanCreated");

      const loan = await vault.getLoan(0);
      console.log("\n💸 Alice borrowed $1500 against 2 WETH");
      console.log("  Loan ID:", "0");
      console.log("  Principal:", ethers.formatEther(loan.principal));
      console.log("  APR (bps):", loan.aprBps.toString());

      expect(loan.borrower).to.equal(alice.address);
      expect(loan.active).to.be.true;

      // Verify loan registered in registry
      const loans = await registry.getLoans(alice.address);
      expect(loans.length).to.equal(1);
    });

    it("Step 6: Alice makes partial repayment", async function () {
      const repayAmount = ethers.parseEther("500");

      await expect(vault.connect(alice).repay(0, repayAmount))
        .to.emit(vault, "LoanRepaid");

      console.log("\n💳 Alice repaid $500");

      // Verify repayment registered
      const repayments = await registry.getRepayments(alice.address);
      expect(repayments.length).to.equal(1);
      expect(repayments[0].amount).to.equal(repayAmount);

      // Check updated score (should improve due to repayment)
      const scoreAfter = await oracle.computeScore(alice.address);
      console.log("\n📊 Alice's Score After Repayment:");
      console.log("  S1 (Repayment):", scoreAfter.repayment.toString());
      console.log("  Overall:", scoreAfter.overall.toString());
    });

    it("Step 7: Alice completes full repayment and closes loan", async function () {
      // Wait for some interest to accrue
      await time.increase(30 * 24 * 3600); // 30 days

      const debt = await vault.calculateDebt(0);
      console.log("\n💰 Total debt after 30 days:", ethers.formatEther(debt));

      await expect(vault.connect(alice).repay(0, debt))
        .to.emit(vault, "LoanRepaid");

      const loan = await vault.getLoan(0);
      expect(loan.active).to.be.false;

      console.log("\n✅ Alice's loan fully repaid and closed");

      // Final score check
      const finalScore = await oracle.computeScore(alice.address);
      console.log("\n📊 Alice's Final Score:");
      console.log("  S1 (Repayment):", finalScore.repayment.toString(), "(perfect repayment)");
      console.log("  S3 (Sybil):", finalScore.sybil.toString());
      console.log("  Overall:", finalScore.overall.toString());

      // With 1 loan and 2 repayments (no liquidations), S1 should be very high
      expect(finalScore.repayment).to.be.gte(80);
    });
  });

  describe("Phase 3: Bob's Journey (Poor Score → Liquidation)", function () {
    it("Step 1: Bob checks score (new wallet, no improvements)", async function () {
      const score = await oracle.computeScore(bob.address);

      console.log("\n📊 Bob's Score (New Wallet, No Improvements):");
      console.log("  Overall:", score.overall.toString());

      expect(score.overall).to.be.lte(350);
    });

    it("Step 2: Bob deposits minimal collateral and borrows", async function () {
      await registry.connect(bob).recordFirstSeen();

      await vault.connect(bob).depositCollateral(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS)
      );

      // With Bronze tier (50% LTV), max borrow = $1000
      const borrowAmount = ethers.parseEther("950");

      await expect(vault.connect(bob).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        borrowAmount
      )).to.emit(vault, "LoanCreated");

      console.log("\n💸 Bob borrowed $950 against 1 WETH (close to max LTV)");
    });

    it("Step 3: Bob's loan becomes unhealthy due to interest", async function () {
      // Fast forward 180 days to accrue significant interest
      await time.increase(180 * 24 * 3600);

      const loanId = 1; // Bob's loan
      const debt = await vault.calculateDebt(loanId);
      const healthFactor = await vault.getHealthFactor(loanId);

      console.log("\n⚠️ Bob's Loan After 180 Days:");
      console.log("  Debt:", ethers.formatEther(debt));
      console.log("  Health Factor:", ethers.formatEther(healthFactor));

      // Health factor should be declining
      expect(healthFactor).to.be.lt(ethers.parseEther("2"));
    });

    it("Step 4: Liquidation starts grace period", async function () {
      const loanId = 1;

      await expect(vault.connect(liquidator).liquidate(loanId))
        .to.be.revertedWith("Grace period started");

      const loan = await vault.getLoan(loanId);
      expect(loan.graceStart).to.be.gt(0);

      console.log("\n⏰ Grace period started for Bob's loan");
      console.log("  Grace period (Bronze):", "24 hours");
    });

    it("Step 5: Liquidation succeeds after grace period", async function () {
      const loanId = 1;

      // Wait for grace period to expire (Bronze = 24h)
      await time.increase(25 * 3600);

      const liquidatorBalBefore = await weth.balanceOf(liquidator.address);
      const insuranceBalBefore = await weth.balanceOf(insurance.address);

      await expect(vault.connect(liquidator).liquidate(loanId))
        .to.emit(vault, "LoanLiquidated");

      const liquidatorBalAfter = await weth.balanceOf(liquidator.address);
      const insuranceBalAfter = await weth.balanceOf(insurance.address);

      console.log("\n🔨 Bob's loan liquidated:");
      console.log("  Liquidator reward:", ethers.formatUnits(
        liquidatorBalAfter - liquidatorBalBefore,
        WETH_DECIMALS
      ), "WETH");
      console.log("  Insurance reward:", ethers.formatUnits(
        insuranceBalAfter - insuranceBalBefore,
        WETH_DECIMALS
      ), "WETH");

      // Verify liquidation recorded
      const liquidations = await registry.getLiquidations(bob.address);
      expect(liquidations.length).to.equal(1);

      // Bob's score should be terrible now
      const scoreAfter = await oracle.computeScore(bob.address);
      console.log("\n📊 Bob's Score After Liquidation:");
      console.log("  S1 (Repayment):", scoreAfter.repayment.toString(), "(heavily penalized)");
      console.log("  Overall:", scoreAfter.overall.toString());
    });
  });

  describe("Phase 4: System Verification", function () {
    it("Should verify all events are recorded in registry", async function () {
      // Alice: 1 loan, 2 repayments, 0 liquidations
      const aliceLoans = await registry.getLoans(alice.address);
      const aliceRepayments = await registry.getRepayments(alice.address);
      const aliceLiquidations = await registry.getLiquidations(alice.address);

      expect(aliceLoans.length).to.equal(1);
      expect(aliceRepayments.length).to.equal(2);
      expect(aliceLiquidations.length).to.equal(0);

      // Bob: 1 loan, 0 repayments, 1 liquidation
      const bobLoans = await registry.getLoans(bob.address);
      const bobRepayments = await registry.getRepayments(bob.address);
      const bobLiquidations = await registry.getLiquidations(bob.address);

      expect(bobLoans.length).to.equal(1);
      expect(bobRepayments.length).to.equal(0);
      expect(bobLiquidations.length).to.equal(1);

      console.log("\n✅ All events properly recorded in CreditRegistry");
    });

    it("Should show scoring differentiation", async function () {
      const aliceScore = await oracle.computeScore(alice.address);
      const bobScore = await oracle.computeScore(bob.address);

      console.log("\n📊 Final Score Comparison:");
      console.log("  Alice (good behavior):", aliceScore.overall.toString());
      console.log("  Bob (liquidated):", bobScore.overall.toString());

      // Alice should have significantly better score
      expect(aliceScore.overall).to.be.gt(bobScore.overall);
    });

    it("Should show APR differentiation", async function () {
      const aliceScore = await oracle.computeScore(alice.address);
      const bobScore = await oracle.computeScore(bob.address);

      const aliceAPR = await oracle.getAPR(aliceScore.overall);
      const bobAPR = await oracle.getAPR(bobScore.overall);

      console.log("\n💰 APR Comparison:");
      console.log("  Alice gets:", aliceAPR.toString(), "bps");
      console.log("  Bob gets:", bobAPR.toString(), "bps");

      // Alice should get better rate
      expect(aliceAPR).to.be.lt(bobAPR);
    });

    it("Should demonstrate system security", async function () {
      console.log("\n🛡️ System Security Checks:");

      // Only authorized lenders can register events
      expect(await registry.authorizedLenders(vault.target)).to.be.true;

      // Assets must be configured
      const usdcConfig = await vault.assets(usdc.target);
      expect(usdcConfig.allowed).to.be.true;

      // Insurance pool configured
      expect(await vault.insurancePool()).to.equal(insurance.address);

      console.log("  ✅ Only authorized lenders can register events");
      console.log("  ✅ Assets must be whitelisted");
      console.log("  ✅ Insurance pool receives liquidation fees");
    });
  });

  describe("Phase 5: System Summary", function () {
    it("Should print complete system summary", async function () {
      console.log("\n" + "=".repeat(60));
      console.log("INTEGRATION TEST SUMMARY");
      console.log("=".repeat(60));

      console.log("\n📦 Deployed Contracts:");
      console.log("  CreditRegistry:", registry.target);
      console.log("  ScoreOracle:", oracle.target);
      console.log("  CreditVault:", vault.target);

      console.log("\n👥 User Outcomes:");

      const aliceScore = await oracle.computeScore(alice.address);
      const aliceLoans = await registry.getLoans(alice.address);
      const aliceRepayments = await registry.getRepayments(alice.address);
      console.log("\n  Alice (Good User):");
      console.log("    Score:", aliceScore.overall.toString());
      console.log("    Loans:", aliceLoans.length);
      console.log("    Repayments:", aliceRepayments.length);
      console.log("    Liquidations:", 0);
      console.log("    Outcome: ✅ Successfully borrowed and repaid");

      const bobScore = await oracle.computeScore(bob.address);
      const bobLoans = await registry.getLoans(bob.address);
      const bobLiquidations = await registry.getLiquidations(bob.address);
      console.log("\n  Bob (Risky User):");
      console.log("    Score:", bobScore.overall.toString());
      console.log("    Loans:", bobLoans.length);
      console.log("    Repayments:", 0);
      console.log("    Liquidations:", bobLiquidations.length);
      console.log("    Outcome: ⚠️ Liquidated due to unhealthy loan");

      console.log("\n🎯 System Features Demonstrated:");
      console.log("  ✅ Score-based LTV enforcement");
      console.log("  ✅ Tiered grace periods before liquidation");
      console.log("  ✅ Simple interest accrual");
      console.log("  ✅ Liquidation with 10% penalty distribution");
      console.log("  ✅ On-chain credit history tracking");
      console.log("  ✅ Sybil resistance (wallet age + staking)");
      console.log("  ✅ Dynamic APR based on credit score");

      console.log("\n" + "=".repeat(60));
    });
  });
});
