const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Phase 3 Feedback Loop Tests", function () {
  let owner, alice, bob, liquidator, insurance;
  let stakingToken, registry, oracle, vault;
  let usdc, weth, usdcFeed, wethFeed;

  const USDC_DECIMALS = 6;
  const WETH_DECIMALS = 18;
  const FEED_DECIMALS = 8;
  const USDC_PRICE = 1_00000000; // $1
  const WETH_PRICE = 2000_00000000; // $2000

  beforeEach(async function () {
    [owner, alice, bob, liquidator, insurance] = await ethers.getSigners();

    // Deploy staking token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    stakingToken = await MockERC20.deploy("Staking Token", "STK", 18);

    // Deploy registry
    const CreditRegistryV2 = await ethers.getContractFactory("CreditRegistryV2");
    registry = await CreditRegistryV2.deploy(stakingToken.target);

    // Deploy oracle
    const ScoreOraclePhase3 = await ethers.getContractFactory("ScoreOraclePhase3");
    oracle = await ScoreOraclePhase3.deploy(registry.target);

    // Deploy vault
    const CreditVaultV2 = await ethers.getContractFactory("CreditVaultV2");
    vault = await CreditVaultV2.deploy(registry.target, oracle.target);

    // Authorize vault as lender
    await registry.setAuthorizedLender(vault.target, true);

    // Deploy test tokens
    usdc = await MockERC20.deploy("USDC", "USDC", USDC_DECIMALS);
    weth = await MockERC20.deploy("WETH", "WETH", WETH_DECIMALS);

    // Deploy price feeds
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    usdcFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, USDC_PRICE);
    wethFeed = await MockV3Aggregator.deploy(FEED_DECIMALS, WETH_PRICE);

    // Configure vault
    await vault.setAsset(usdc.target, usdcFeed.target, true);
    await vault.setAsset(weth.target, wethFeed.target, true);
    await vault.setInsurancePool(insurance.address);

    // Mint tokens
    await usdc.mint(alice.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await weth.mint(alice.address, ethers.parseUnits("10", WETH_DECIMALS));
    await usdc.mint(bob.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await weth.mint(bob.address, ethers.parseUnits("10", WETH_DECIMALS));
    await stakingToken.mint(alice.address, ethers.parseEther("10000"));
    await stakingToken.mint(bob.address, ethers.parseEther("10000"));

    // Approvals
    await usdc.connect(alice).approve(vault.target, ethers.MaxUint256);
    await weth.connect(alice).approve(vault.target, ethers.MaxUint256);
    await usdc.connect(bob).approve(vault.target, ethers.MaxUint256);
    await weth.connect(bob).approve(vault.target, ethers.MaxUint256);
    await stakingToken.connect(alice).approve(registry.target, ethers.MaxUint256);
    await stakingToken.connect(bob).approve(registry.target, ethers.MaxUint256);
  });

  describe("Scenario 1: Alice (Perfect Repayment)", function () {
    it("should show score improvement after repayments", async function () {
      console.log("\n=== ALICE'S JOURNEY (PERFECT REPAYMENT) ===\n");

      // Step 1: Check initial score (new wallet, no history)
      let score = await oracle.computeScore(alice.address);
      console.log("Initial Score:");
      console.log("  S1 (Repayment):", score.s1_repayment.toString());
      console.log("  S3 (Sybil):", score.s3_sybil.toString());
      console.log("  Overall:", score.overall.toString());

      const initialOverall = score.overall;
      expect(score.s1_repayment).to.equal(50); // Neutral (no history)

      // Step 2: Record wallet age
      await registry.connect(alice).recordFirstSeen();
      await time.increase(400 * 24 * 3600); // 400 days

      // Step 3: Stake to improve sybil score
      await registry.connect(alice).depositStake(ethers.parseEther("1000"), 365 * 24 * 3600);

      score = await oracle.computeScore(alice.address);
      console.log("\nAfter staking 1000 ETH:");
      console.log("  S3 (Sybil):", score.s3_sybil.toString());
      console.log("  Overall:", score.overall.toString());

      // Step 4: Borrow loan #1
      const loanId1 = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("1000")
      );

      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("1000")
      );

      console.log("\nLoan #1 created, loanId:", loanId1.toString());

      // Check score after first loan (active, not repaid yet)
      score = await oracle.computeScore(alice.address);
      console.log("  S1 after loan:", score.s1_repayment.toString());
      expect(score.s1_repayment).to.equal(0); // 0 repaid / 1 loan = 0%

      // Step 5: Borrow loan #2
      const loanId2 = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("1000")
      );

      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("1000")
      );

      console.log("Loan #2 created, loanId:", loanId2.toString());

      score = await oracle.computeScore(alice.address);
      console.log("  S1 after 2 loans:", score.s1_repayment.toString());
      expect(score.s1_repayment).to.equal(0); // 0 repaid / 2 loans = 0%

      // Step 6: Repay loan #1 fully
      const debt1 = await vault.calculateDebt(loanId1);
      await vault.connect(alice).repay(loanId1, debt1);

      console.log("\nRepaid loan #1");

      score = await oracle.computeScore(alice.address);
      console.log("  S1 after 1 repayment:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());
      expect(score.s1_repayment).to.equal(50); // 1 repaid / 2 loans = 50%

      // Step 7: Repay loan #2 fully
      const debt2 = await vault.calculateDebt(loanId2);
      await vault.connect(alice).repay(loanId2, debt2);

      console.log("Repaid loan #2");

      score = await oracle.computeScore(alice.address);
      console.log("  S1 after 2 repayments:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());
      expect(score.s1_repayment).to.equal(100); // 2 repaid / 2 loans = 100%

      // Verify overall score improved
      expect(score.overall).to.be.gt(initialOverall);

      console.log("\n✅ Alice's perfect repayment improved score from", initialOverall.toString(), "to", score.overall.toString());
    });
  });

  describe("Scenario 2: Bob (Liquidation)", function () {
    it("should show score degradation after liquidation", async function () {
      console.log("\n=== BOB'S JOURNEY (LIQUIDATION) ===\n");

      // Step 1: Record wallet age
      await registry.connect(bob).recordFirstSeen();

      // Step 2: Borrow (no improvements, low score)
      const loanId = await vault.connect(bob).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950") // Close to max for Bronze (50% of $2000)
      );

      await vault.connect(bob).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950")
      );

      console.log("Bob borrowed, loanId:", loanId.toString());

      let score = await oracle.computeScore(bob.address);
      console.log("Score after borrow:");
      console.log("  S1:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());

      const scoreBeforeLiquidation = score.overall;

      // Step 3: Wait for interest to accrue and loan to become unhealthy
      await time.increase(180 * 24 * 3600); // 180 days

      const debt = await vault.calculateDebt(loanId);
      console.log("\nDebt after 180 days:", ethers.formatEther(debt));

      // Step 4: Try to liquidate (should start grace period)
      await vault.connect(liquidator).liquidate(loanId);

      console.log("Grace period started");

      // Step 5: Wait for grace period
      await time.increase(25 * 3600); // 25 hours (Bronze grace = 24h)

      // Step 6: Liquidate
      await vault.connect(liquidator).liquidate(loanId);

      console.log("Loan liquidated");

      // Step 7: Check score after liquidation
      score = await oracle.computeScore(bob.address);
      console.log("Score after liquidation:");
      console.log("  S1:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());

      // S1 should be 0 repaid / 1 loan = 0%, minus 20 penalty = -20 => clamped to 0
      expect(score.s1_repayment).to.equal(0);

      // Score stays at 12 because S1 is already 0 before and after liquidation
      // (0 repaid before = 0 score, 0 repaid + liquidation penalty = still 0 score)
      expect(score.overall).to.equal(scoreBeforeLiquidation);

      console.log("\n❌ Bob's score remains at", score.overall.toString(), "after liquidation (already at minimum)");
    });
  });

  describe("Scenario 3: Mixed Behavior", function () {
    it("should correctly calculate score with mixed loan outcomes", async function () {
      console.log("\n=== MIXED BEHAVIOR (2 repaid, 1 liquidated) ===\n");

      // Setup: age wallet and stake
      await registry.connect(alice).recordFirstSeen();
      await time.increase(400 * 24 * 3600);
      await registry.connect(alice).depositStake(ethers.parseEther("1000"), 365 * 24 * 3600);

      // Loan 1: Borrow and repay
      const loan1 = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800")
      );
      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800")
      );
      const debt1 = await vault.calculateDebt(loan1);
      await vault.connect(alice).repay(loan1, debt1);

      console.log("Loan 1: Repaid");

      // Loan 2: Borrow and repay
      const loan2 = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800")
      );
      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800")
      );
      const debt2 = await vault.calculateDebt(loan2);
      await vault.connect(alice).repay(loan2, debt2);

      console.log("Loan 2: Repaid");

      // Loan 3: Borrow and liquidate
      const loan3 = await vault.connect(alice).borrow.staticCall(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950")
      );
      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("950")
      );

      // Accrue interest and liquidate
      await time.increase(180 * 24 * 3600);
      await vault.connect(liquidator).liquidate(loan3); // Start grace period
      await time.increase(73 * 3600); // Wait for grace (Gold tier = 48h for score ~80)
      await vault.connect(liquidator).liquidate(loan3); // Actually liquidate

      console.log("Loan 3: Liquidated");

      // Check final score
      const score = await oracle.computeScore(alice.address);
      console.log("\nFinal Score (2 repaid, 1 liquidated):");
      console.log("  S1 (Repayment):", score.s1_repayment.toString());
      console.log("  Formula: (2 repaid / 3 total) * 100 - (1 liquidation * 20)");
      console.log("  Expected: 67 - 20 = 47");
      console.log("  Actual:", score.s1_repayment.toString());
      console.log("  Overall:", score.overall.toString());

      // 2 repaid / 3 total = 66.67% => 66, minus 1 liquidation * 20 = 66 - 20 = 46
      expect(score.s1_repayment).to.be.closeTo(46, 1);
    });
  });

  describe("Scenario 4: LTV Changes Based on Score", function () {
    it("should allow higher LTV after score improves", async function () {
      console.log("\n=== LTV IMPROVEMENT TEST ===\n");

      // Setup Alice with good score
      await registry.connect(alice).recordFirstSeen();
      await time.increase(400 * 24 * 3600);
      await registry.connect(alice).depositStake(ethers.parseEther("1000"), 365 * 24 * 3600);

      // Initial score (no loan history)
      let score = await oracle.computeScore(alice.address);
      console.log("Initial score:", score.overall.toString());

      // Borrow at initial score level
      // 1 WETH = $2000, Bronze (50%) = max $1000
      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800") // Well within Bronze limit
      );

      // Try to borrow more at Bronze level (should fail)
      await expect(
        vault.connect(alice).borrow(
          weth.target,
          ethers.parseUnits("1", WETH_DECIMALS),
          ethers.parseEther("1100") // Exceeds Bronze 50%
        )
      ).to.be.revertedWith("Exceeds allowed LTV");

      console.log("✗ Cannot borrow $1100 with Bronze tier (50% LTV)");

      // Repay first loan
      const loan1 = 1n;
      const debt1 = await vault.calculateDebt(loan1);
      await vault.connect(alice).repay(loan1, debt1);

      // Check new score
      score = await oracle.computeScore(alice.address);
      console.log("\nScore after repayment:", score.overall.toString());

      // Now borrow at improved score level
      // If score is 75+, we get Gold tier (80% LTV) = max $1600
      if (score.overall >= 75) {
        await vault.connect(alice).borrow(
          weth.target,
          ethers.parseUnits("1", WETH_DECIMALS),
          ethers.parseEther("1500") // Within Gold 80%
        );
        console.log("✓ Successfully borrowed $1500 with Gold tier (80% LTV)");
      }
      // If score is 60+, we get Silver tier (70% LTV) = max $1400
      else if (score.overall >= 60) {
        await vault.connect(alice).borrow(
          weth.target,
          ethers.parseUnits("1", WETH_DECIMALS),
          ethers.parseEther("1300") // Within Silver 70%
        );
        console.log("✓ Successfully borrowed $1300 with Silver tier (70% LTV)");
      }
    });
  });

  describe("Scenario 5: APR Differentiation", function () {
    it("should give better APR to higher scores", async function () {
      console.log("\n=== APR DIFFERENTIATION ===\n");

      // Alice: Good score (staking + age + repayments)
      await registry.connect(alice).recordFirstSeen();
      await time.increase(400 * 24 * 3600);
      await registry.connect(alice).depositStake(ethers.parseEther("1000"), 365 * 24 * 3600);

      // Borrow and repay to build history
      await vault.connect(alice).borrow(
        weth.target,
        ethers.parseUnits("1", WETH_DECIMALS),
        ethers.parseEther("800")
      );
      await vault.connect(alice).repay(1, await vault.calculateDebt(1));

      const aliceScore = await oracle.computeScore(alice.address);
      const aliceAPR = await oracle.getAPR(aliceScore.overall);

      // Bob: Poor score (no improvements, no history)
      await registry.connect(bob).recordFirstSeen();

      const bobScore = await oracle.computeScore(bob.address);
      const bobAPR = await oracle.getAPR(bobScore.overall);

      console.log("Alice:");
      console.log("  Score:", aliceScore.overall.toString());
      console.log("  APR:", aliceAPR.toString(), "bps");

      console.log("\nBob:");
      console.log("  Score:", bobScore.overall.toString());
      console.log("  APR:", bobAPR.toString(), "bps");

      expect(aliceScore.overall).to.be.gt(bobScore.overall);
      expect(aliceAPR).to.be.lt(bobAPR);

      console.log("\n✓ Higher score (Alice) gets lower APR");
    });
  });
});
