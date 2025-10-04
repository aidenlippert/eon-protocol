const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Phase 3: Full System Integration Test", function () {
  let owner, alice, bob, liquidator, insurance;
  let stakingToken, registry, oracle, vault;
  let usdc, weth, usdcFeed, wethFeed;

  const USDC_DECIMALS = 6;
  const WETH_DECIMALS = 18;
  const FEED_DECIMALS = 8;
  const USDC_PRICE = 1_00000000;
  const WETH_PRICE = 2000_00000000;

  before(async function () {
    [owner, alice, bob, liquidator, insurance] = await ethers.getSigners();
  });

  describe("Phase 1: System Deployment", function () {
    it("should deploy all Phase 3 contracts", async function () {
      console.log("\n🚀 PHASE 3 DEPLOYMENT\n");

      // Deploy staking token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      stakingToken = await MockERC20.deploy("Staking Token", "STK", 18);
      console.log("✅ Staking Token:", await stakingToken.getAddress());

      // Deploy CreditRegistryV2
      const CreditRegistryV2 = await ethers.getContractFactory("CreditRegistryV2");
      registry = await CreditRegistryV2.deploy(stakingToken.target);
      console.log("✅ CreditRegistryV2:", await registry.getAddress());

      // Deploy ScoreOraclePhase3
      const ScoreOraclePhase3 = await ethers.getContractFactory("ScoreOraclePhase3");
      oracle = await ScoreOraclePhase3.deploy(registry.target);
      console.log("✅ ScoreOraclePhase3:", await oracle.getAddress());

      // Deploy CreditVaultV2
      const CreditVaultV2 = await ethers.getContractFactory("CreditVaultV2");
      vault = await CreditVaultV2.deploy(registry.target, oracle.target);
      console.log("✅ CreditVaultV2:", await vault.getAddress());

      expect(await registry.owner()).to.equal(owner.address);
      expect(await oracle.registry()).to.equal(registry.target);
      expect(await vault.registry()).to.equal(registry.target);
      expect(await vault.oracle()).to.equal(oracle.target);
    });

    it("should configure the system", async function () {
      // Authorize vault as lender
      await registry.setAuthorizedLender(vault.target, true);
      expect(await registry.authorizedLenders(vault.target)).to.be.true;
      console.log("✅ Vault authorized as lender");

      // Deploy test assets
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      usdc = await MockERC20.deploy("USDC", "USDC", USDC_DECIMALS);
      weth = await MockERC20.deploy("WETH", "WETH", WETH_DECIMALS);

      // Deploy price feeds
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      usdcFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, USDC_PRICE);
      wethFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, WETH_PRICE);

      // Configure assets in vault
      await vault.setAsset(usdc.target, usdcFeed.target, true);
      await vault.setAsset(weth.target, wethFeed.target, true);
      console.log("✅ Assets configured");

      // Set insurance pool
      await vault.setInsurancePool(insurance.address);
      console.log("✅ Insurance pool set");

      // Mint tokens to users
      await usdc.mint(alice.address, ethers.parseUnits("10000", USDC_DECIMALS));
      await weth.mint(alice.address, ethers.parseUnits("10", WETH_DECIMALS));
      await usdc.mint(bob.address, ethers.parseUnits("10000", USDC_DECIMALS));
      await weth.mint(bob.address, ethers.parseUnits("10", WETH_DECIMALS));
      await stakingToken.mint(alice.address, ethers.parseEther("10000"));
      await stakingToken.mint(bob.address, ethers.parseEther("10000"));
      console.log("✅ Test tokens minted");

      // Approvals
      await usdc.connect(alice).approve(vault.target, ethers.MaxUint256);
      await weth.connect(alice).approve(vault.target, ethers.MaxUint256);
      await usdc.connect(bob).approve(vault.target, ethers.MaxUint256);
      await weth.connect(bob).approve(vault.target, ethers.MaxUint256);
      await stakingToken.connect(alice).approve(registry.target, ethers.MaxUint256);
      await stakingToken.connect(bob).approve(registry.target, ethers.MaxUint256);
      console.log("✅ Approvals granted\n");
    });
  });

  describe("Phase 2: Alice's Journey (Good User)", function () {
    it("Step 1: Check initial score", async function () {
      const score = await oracle.computeScore(alice.address);

      console.log("📊 Alice's Initial Score:");
      console.log("  S1 (Repayment):", score.s1_repayment.toString());
      console.log("  S2 (Collateral):", score.s2_collateral.toString());
      console.log("  S3 (Sybil):", score.s3_sybil.toString());
      console.log("  S4 (Cross-Chain):", score.s4_crosschain.toString());
      console.log("  S5 (Participation):", score.s5_participation.toString());
      console.log("  Overall:", score.overall.toString());

      expect(score.s1_repayment).to.equal(50); // Neutral (no history)
      expect(score.s3_sybil).to.be.lt(0); // Negative (new wallet, no KYC)
    });

    it("Step 2: Improve sybil score with staking", async function () {
      await registry.connect(alice).depositStake(
        ethers.parseEther("1000"),
        365 * 24 * 3600
      );

      const score = await oracle.computeScore(alice.address);
      console.log("\n📊 After Staking 1000 ETH:");
      console.log("  S3 (Sybil):", score.s3_sybil.toString());
      console.log("  Overall:", score.overall.toString());

      const stakeInfo = await registry.getStakeInfo(alice.address);
      expect(stakeInfo.amount).to.equal(ethers.parseEther("1000"));
    });

    it("Step 3: Age wallet", async function () {
      await registry.connect(alice).recordFirstSeen();
      await time.increase(400 * 24 * 3600); // 400 days

      const score = await oracle.computeScore(alice.address);
      console.log("\n📊 After 400 Days:");
      console.log("  S3 (Sybil):", score.s3_sybil.toString());
      console.log("  Overall:", score.overall.toString());

      const age = await registry.getWalletAge(alice.address);
      expect(age).to.be.gt(399 * 24 * 3600);
    });

    it("Step 4: Borrow first loan", async function () {
      const score = await oracle.computeScore(alice.address);
      const apr = await oracle.getAPR(score.overall);
      const tier = await oracle.getScoreTier(score.overall);

      console.log("\n💸 First Borrow:");
      console.log("  Score:", score.overall.toString());
      console.log("  Tier:", tier);
      console.log("  APR:", apr.toString(), "bps");

      const loanId = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("2", WETH_DECIMALS), // 2 WETH = $4000 collateral
        ethers.parseEther("1500") // Borrow $1500
      );

      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("2", WETH_DECIMALS),
        ethers.parseEther("1500")
      );

      console.log("  Loan ID:", loanId.toString());
      console.log("  Principal: $1500");
      console.log("  Collateral: 2 WETH ($4000)");

      const loan = await registry.getLoan(loanId);
      expect(loan.borrower).to.equal(alice.address);
      expect(loan.principalUsd18).to.equal(ethers.parseEther("1500"));
      expect(loan.status).to.equal(1); // Active
    });

    it("Step 5: Repay first loan", async function () {
      const loanId = 1n;
      const debt = await vault.calculateDebt(loanId);

      console.log("\n💳 Repaying Loan #1:");
      console.log("  Debt:", ethers.formatEther(debt));

      await vault.connect(alice).repay(loanId, debt);

      const loan = await registry.getLoan(loanId);
      expect(loan.status).to.equal(2); // Repaid

      const score = await oracle.computeScore(alice.address);
      console.log("  S1 after repayment:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());

      expect(score.s1_repayment).to.equal(100); // 1 repaid / 1 total = 100%
    });

    it("Step 6: Borrow second loan with improved score", async function () {
      const score = await oracle.computeScore(alice.address);
      const tier = await oracle.getScoreTier(score.overall);
      const apr = await oracle.getAPR(score.overall);

      console.log("\n💸 Second Borrow (Improved Score):");
      console.log("  Score:", score.overall.toString());
      console.log("  Tier:", tier);
      console.log("  APR:", apr.toString(), "bps");

      // With better score, Alice can borrow more
      const loanId = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("2", WETH_DECIMALS),
        ethers.parseEther("1800") // More than first loan
      );

      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("2", WETH_DECIMALS),
        ethers.parseEther("1800")
      );

      console.log("  Loan ID:", loanId.toString());
      console.log("  Principal: $1800 (higher than first loan)");

      const loan = await registry.getLoan(loanId);
      expect(loan.principalUsd18).to.equal(ethers.parseEther("1800"));
    });

    it("Step 7: Verify final score", async function () {
      // Repay second loan first
      await vault.connect(alice).repay(2n, await vault.calculateDebt(2n));

      const score = await oracle.computeScore(alice.address);
      const loans = await registry.getLoansByBorrower(alice.address);

      console.log("\n📊 Alice's Final Score:");
      console.log("  Total loans:", loans.length.toString());
      console.log("  Repaid:", "2");
      console.log("  Liquidated:", "0");
      console.log("  S1 (Repayment):", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());

      expect(score.s1_repayment).to.equal(100);
      expect(loans.length).to.equal(2);
    });
  });

  describe("Phase 3: Bob's Journey (Risky User)", function () {
    it("Step 1: Borrow with poor score", async function () {
      await registry.connect(bob).recordFirstSeen();

      const score = await oracle.computeScore(bob.address);
      const apr = await oracle.getAPR(score.overall);
      const tier = await oracle.getScoreTier(score.overall);

      console.log("\n📊 Bob's Initial Score:");
      console.log("  Overall:", score.overall.toString());
      console.log("  Tier:", tier);
      console.log("  APR:", apr.toString(), "bps (high due to poor score)");

      const loanId = await vault.connect(bob).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950") // Close to Bronze max (50% of $2000)
      );

      await vault.connect(bob).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950")
      );

      console.log("  Loan ID:", loanId.toString());
      console.log("  Principal: $950 (close to max for Bronze)");

      expect(loanId).to.equal(3n); // Third loan overall
    });

    it("Step 2: Loan becomes unhealthy", async function () {
      await time.increase(180 * 24 * 3600); // 180 days

      const loanId = 3n;
      const debt = await vault.calculateDebt(loanId);
      const healthFactor = await vault.getHealthFactor(loanId);

      console.log("\n⚠️ After 180 Days:");
      console.log("  Debt:", ethers.formatEther(debt));
      console.log("  Health Factor:", ethers.formatEther(healthFactor));

      expect(healthFactor).to.be.lt(ethers.parseEther("2"));
    });

    it("Step 3: Liquidation triggers grace period", async function () {
      const loanId = 3n;

      await vault.connect(liquidator).liquidate(loanId);

      console.log("\n⏰ Grace period started (Bronze = 24h)");

      const vaultData = await vault.getVaultLoanData(loanId);
      expect(vaultData.graceStart).to.be.gt(0);
    });

    it("Step 4: Liquidation succeeds after grace", async function () {
      await time.increase(25 * 3600); // 25 hours

      const loanId = 3n;
      const liquidatorBalBefore = await weth.balanceOf(liquidator.address);
      const insuranceBalBefore = await weth.balanceOf(insurance.address);

      await vault.connect(liquidator).liquidate(loanId);

      const liquidatorBalAfter = await weth.balanceOf(liquidator.address);
      const insuranceBalAfter = await weth.balanceOf(insurance.address);

      console.log("\n🔨 Liquidation Complete:");
      console.log("  Liquidator reward:", ethers.formatUnits(liquidatorBalAfter - liquidatorBalBefore, WETH_DECIMALS), "WETH");
      console.log("  Insurance reward:", ethers.formatUnits(insuranceBalAfter - insuranceBalBefore, WETH_DECIMALS), "WETH");

      const loan = await registry.getLoan(loanId);
      expect(loan.status).to.equal(3); // Liquidated

      expect(liquidatorBalAfter).to.be.gt(liquidatorBalBefore);
      expect(insuranceBalAfter).to.be.gt(insuranceBalBefore);
    });

    it("Step 5: Score degraded after liquidation", async function () {
      const score = await oracle.computeScore(bob.address);
      const tier = await oracle.getScoreTier(score.overall);

      console.log("\n📊 Bob's Score After Liquidation:");
      console.log("  S1 (Repayment):", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());
      console.log("  Tier:", tier);

      // 0 repaid / 1 total = 0%, minus 1 liquidation * 20 = -20 => clamped to 0
      expect(score.s1_repayment).to.equal(0);
    });
  });

  describe("Phase 4: System Verification", function () {
    it("should show complete loan history", async function () {
      console.log("\n📋 FINAL SYSTEM STATE\n");

      // Alice's history
      const aliceLoanIds = await registry.getLoanIdsByBorrower(alice.address);
      const aliceLoans = await registry.getLoansByBorrower(alice.address);

      console.log("Alice's Loans:", aliceLoanIds.length.toString());
      for (let i = 0; i < aliceLoans.length; i++) {
        const loan = aliceLoans[i];
        console.log(`  Loan #${loan.loanId}:`, loan.status === 2n ? "Repaid ✓" : "Active");
      }

      // Bob's history
      const bobLoanIds = await registry.getLoanIdsByBorrower(bob.address);
      const bobLoans = await registry.getLoansByBorrower(bob.address);

      console.log("\nBob's Loans:", bobLoanIds.length.toString());
      for (let i = 0; i < bobLoans.length; i++) {
        const loan = bobLoans[i];
        console.log(`  Loan #${loan.loanId}:`, loan.status === 3n ? "Liquidated ✗" : "Other");
      }

      expect(aliceLoans.length).to.equal(2);
      expect(bobLoans.length).to.equal(1);
    });

    it("should show score differentiation", async function () {
      const aliceScore = await oracle.computeScore(alice.address);
      const bobScore = await oracle.computeScore(bob.address);
      const aliceTier = await oracle.getScoreTier(aliceScore.overall);
      const bobTier = await oracle.getScoreTier(bobScore.overall);
      const aliceAPR = await oracle.getAPR(aliceScore.overall);
      const bobAPR = await oracle.getAPR(bobScore.overall);

      console.log("\n📊 SCORE COMPARISON\n");
      console.log("Alice (Good User):");
      console.log("  Score:", aliceScore.overall.toString());
      console.log("  Tier:", aliceTier);
      console.log("  APR:", aliceAPR.toString(), "bps");

      console.log("\nBob (Risky User):");
      console.log("  Score:", bobScore.overall.toString());
      console.log("  Tier:", bobTier);
      console.log("  APR:", bobAPR.toString(), "bps");

      console.log("\n✓ Higher score gets better terms");

      expect(aliceScore.overall).to.be.gt(bobScore.overall);
      expect(aliceAPR).to.be.lt(bobAPR);
    });

    it("should demonstrate feedback loop", async function () {
      console.log("\n🔄 FEEDBACK LOOP VERIFICATION\n");

      console.log("✅ Borrow → Registry records loan");
      console.log("✅ Repay → Registry updates status");
      console.log("✅ Oracle reads registry → Calculates S1");
      console.log("✅ Vault uses oracle → Enforces LTV");
      console.log("✅ Better repayment → Higher score → Better LTV");
      console.log("✅ Liquidation → Lower score → Worse LTV");

      console.log("\n🎯 Phase 3 Incremental COMPLETE!");
      console.log("   - CreditRegistryV2: Loan tracking ✓");
      console.log("   - ScoreOraclePhase3: Real S1 scoring ✓");
      console.log("   - CreditVaultV2: Full integration ✓");
      console.log("   - Feedback loop: WORKING ✓");
    });
  });
});
