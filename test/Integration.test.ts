import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  ReputationScorer,
  DutchAuctionLiquidator,
  HealthFactorMonitor,
  InsuranceFund,
  MockLendingPool,
  MockERC20
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Integration Tests - Complete User Journey", function () {
  let reputationScorer: ReputationScorer;
  let liquidator: DutchAuctionLiquidator;
  let healthMonitor: HealthFactorMonitor;
  let insuranceFund: InsuranceFund;
  let lendingPool: MockLendingPool;
  let stablecoin: MockERC20;

  let owner: SignerWithAddress;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;
  let lender: SignerWithAddress;
  let liquidatorUser: SignerWithAddress;

  beforeEach(async function () {
    [owner, borrower1, borrower2, lender, liquidatorUser] = await ethers.getSigners();

    // Deploy all contracts
    const ReputationScorerFactory = await ethers.getContractFactory("ReputationScorer");
    reputationScorer = await ReputationScorerFactory.deploy();

    const MockLendingPoolFactory = await ethers.getContractFactory("MockLendingPool");
    lendingPool = await MockLendingPoolFactory.deploy();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC");

    const LiquidatorFactory = await ethers.getContractFactory("DutchAuctionLiquidator");
    liquidator = await LiquidatorFactory.deploy(
      await reputationScorer.getAddress(),
      await lendingPool.getAddress()
    );

    const HealthMonitorFactory = await ethers.getContractFactory("HealthFactorMonitor");
    const mockOracle = await owner.getAddress(); // Simplified for testing
    healthMonitor = await HealthMonitorFactory.deploy(
      await reputationScorer.getAddress(),
      await lendingPool.getAddress(),
      mockOracle
    );

    const InsuranceFundFactory = await ethers.getContractFactory("InsuranceFund");
    insuranceFund = await InsuranceFundFactory.deploy(await stablecoin.getAddress());

    // Setup authorizations
    await reputationScorer.setAuthorizedUpdater(await lendingPool.getAddress(), true);
    await reputationScorer.setAuthorizedUpdater(await liquidator.getAddress(), true);
    await reputationScorer.setAuthorizedUpdater(await healthMonitor.getAddress(), true);
    await insuranceFund.setAuthorizedRequestor(await lendingPool.getAddress(), true);
  });

  describe("Scenario 1: New User → Borrowing → Successful Repayment", function () {
    it("Should handle complete successful loan cycle", async function () {
      // Step 1: New user starts with Bronze tier (no history)
      await reputationScorer.calculateScore(borrower1.address, 300); // Low temporal score
      let score = await reputationScorer.scores(borrower1.address);

      expect(await reputationScorer.getCreditTier(borrower1.address)).to.equal("Bronze");
      expect(await reputationScorer.getDynamicLTV(borrower1.address)).to.equal(50);

      // Step 2: User takes first loan with 50% LTV
      await lendingPool.setLoan(
        1,
        borrower1.address,
        ethers.parseEther("1"),    // 1 ETH collateral
        ethers.parseEther("0.5"),  // 0.5 ETH borrowed (50% LTV)
        true
      );

      // Step 3: Calculate health factor (should be healthy)
      await healthMonitor.calculateHealthFactor(borrower1.address, 1);
      let healthStatus = await healthMonitor.getHealthStatus(borrower1.address, 1);

      expect(healthStatus!.healthFactor).to.be.gt(ethers.parseEther("0.95"));
      expect(healthStatus!.liquidatable).to.be.false;

      // Step 4: User repays on time
      const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
      await reputationScorer.recordPayment(
        borrower1.address,
        1,
        ethers.parseEther("0.5"),
        dueDate,
        true // on time
      );

      // Step 5: Score improves after on-time payment
      await reputationScorer.calculateScore(borrower1.address, 300);
      score = await reputationScorer.scores(borrower1.address);

      expect(score.paymentScore).to.be.gt(100); // Better than neutral

      // Step 6: After multiple on-time payments, tier improves
      for (let i = 2; i <= 12; i++) {
        await reputationScorer.recordPayment(
          borrower1.address,
          i,
          ethers.parseEther("0.5"),
          Math.floor(Date.now() / 1000),
          true
        );
      }

      await reputationScorer.calculateScore(borrower1.address, 500); // Improved temporal score
      score = await reputationScorer.scores(borrower1.address);

      expect(score.tier).to.equal("Silver"); // Upgraded!
      expect(await reputationScorer.getDynamicLTV(borrower1.address)).to.equal(65);
    });
  });

  describe("Scenario 2: Health Factor Deterioration → Liquidation", function () {
    it("Should handle unhealthy loan → auction → liquidation", async function () {
      // Step 1: Start with Gold tier borrower
      await reputationScorer.calculateScore(borrower1.address, 700);
      expect(await reputationScorer.getCreditTier(borrower1.address)).to.equal("Gold");

      // Step 2: Borrow at 75% LTV (Gold tier)
      await lendingPool.setLoan(
        1,
        borrower1.address,
        ethers.parseEther("1"),    // 1 ETH collateral
        ethers.parseEther("0.75"), // 0.75 ETH borrowed (75% LTV)
        true
      );

      // Step 3: Initial health factor is healthy
      await healthMonitor.calculateHealthFactor(borrower1.address, 1);
      let healthStatus = await healthMonitor.getHealthStatus(borrower1.address, 1);
      expect(healthStatus!.healthFactor).to.be.gte(ethers.parseEther("0.95"));

      // Step 4: Simulate collateral value drop (update mock oracle)
      // In production, oracle would return lower price
      // For test, we increase debt to simulate same effect
      await lendingPool.setLoan(
        1,
        borrower1.address,
        ethers.parseEther("1"),    // Same collateral
        ethers.parseEther("0.95"), // Increased debt
        true
      );

      // Step 5: Health factor now below threshold
      await healthMonitor.calculateHealthFactor(borrower1.address, 1);
      healthStatus = await healthMonitor.getHealthStatus(borrower1.address, 1);
      expect(healthStatus!.healthFactor).to.be.lt(ethers.parseEther("0.95"));
      expect(healthStatus!.liquidatable).to.be.true;

      // Step 6: Start liquidation auction
      await liquidator.startLiquidation(1);
      const auctionId = 0;

      // Step 7: Gold tier gets 24h grace period
      let gracePeriodRemaining = await liquidator.getGracePeriodRemaining(auctionId);
      expect(gracePeriodRemaining).to.be.closeTo(24 * 60 * 60, 10);

      // Step 8: Cannot execute during grace period
      await expect(
        liquidator.connect(liquidatorUser).executeLiquidation(auctionId)
      ).to.be.revertedWith("Grace period active");

      // Step 9: After grace period, execute liquidation
      await time.increase(24 * 60 * 60 + 1); // 24 hours + 1 second

      await liquidator.connect(liquidatorUser).executeLiquidation(auctionId);

      const auction = await liquidator.getAuction(auctionId);
      expect(auction.executed).to.be.true;
      expect(auction.executor).to.equal(liquidatorUser.address);
    });
  });

  describe("Scenario 3: Late Payments → Tier Downgrade → Higher Liquidation Risk", function () {
    it("Should handle payment issues and tier downgrade", async function () {
      // Step 1: Start with Platinum tier
      await reputationScorer.calculateScore(borrower1.address, 850);
      expect(await reputationScorer.getCreditTier(borrower1.address)).to.equal("Platinum");
      expect(await reputationScorer.getDynamicLTV(borrower1.address)).to.equal(90);

      // Step 2: Record several late payments
      for (let i = 1; i <= 8; i++) {
        await reputationScorer.recordPayment(
          borrower1.address,
          i,
          ethers.parseEther("1"),
          Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60), // 10 days late
          false
        );
      }

      // Step 3: Recalculate with lower base score due to temporal decay
      // In Phase 1, totalScore = baseScore, so we need to lower baseScore to simulate tier downgrade
      await reputationScorer.calculateScore(borrower1.address, 750); // Lower temporal score
      let score = await reputationScorer.scores(borrower1.address);

      // Payment score should be very low
      expect(score.paymentScore).to.be.lt(50);

      // Total score drops below Platinum threshold (now 750)
      expect(score.totalScore).to.be.lt(800);
      expect(score.tier).to.not.equal("Platinum");

      // Step 4: LTV reduced due to lower tier
      const newLTV = await reputationScorer.getDynamicLTV(borrower1.address);
      expect(newLTV).to.be.lt(90);

      // Step 5: Existing loan at 90% LTV now unhealthy
      await lendingPool.setLoan(
        1,
        borrower1.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.9"), // Was okay at 90% LTV, now risky
        true
      );

      await healthMonitor.calculateHealthFactor(borrower1.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower1.address, 1);

      // Health factor deteriorates due to lower LTV
      expect(healthStatus!.healthFactor).to.be.lt(ethers.parseEther("1.0"));

      // Step 6: Shorter grace period due to tier downgrade
      await liquidator.startLiquidation(1);
      const gracePeriod = await liquidator.getGracePeriodRemaining(0);
      expect(gracePeriod).to.be.lt(72 * 60 * 60); // Less than Platinum's 72h
    });
  });

  describe("Scenario 4: Insurance Fund Coverage on Default", function () {
    it("Should cover partial loss from insurance fund", async function () {
      // Step 1: Fund insurance pool
      await stablecoin.mint(owner.address, ethers.parseEther("10000"));
      await stablecoin.approve(await insuranceFund.getAddress(), ethers.parseEther("10000"));
      await insuranceFund.deposit(ethers.parseEther("10000"));

      let stats = await insuranceFund.getStatistics();
      expect(stats._totalFunds).to.equal(ethers.parseEther("10000"));

      // Step 2: Loan defaults (undercollateralized)
      const loanId = 1;
      const principal = ethers.parseEther("1000");
      const lossAmount = ethers.parseEther("200"); // 20% loss

      // Step 3: Request coverage
      await stablecoin.mint(await lendingPool.getAddress(), lossAmount);
      await stablecoin.connect(lender).approve(await insuranceFund.getAddress(), lossAmount);

      const coveredAmount = await insuranceFund.getAvailableCoverage(principal);

      // Maximum 0.25% coverage
      const maxCoverage = (principal * BigInt(25)) / BigInt(10000);
      expect(coveredAmount).to.equal(maxCoverage);

      // Step 4: Cover loss (lending pool calls insurance fund)
      await insuranceFund.connect(owner).coverLoss(
        lender.address,
        loanId,
        principal,
        lossAmount
      );

      stats = await insuranceFund.getStatistics();
      expect(stats._totalCovered).to.equal(coveredAmount);
      expect(stats._totalDefaults).to.equal(1);
    });
  });

  describe("Scenario 5: Multiple Concurrent Liquidations", function () {
    it("Should handle multiple liquidations simultaneously", async function () {
      // Setup 3 borrowers with different tiers
      await reputationScorer.calculateScore(borrower1.address, 850); // Platinum - 72h
      await reputationScorer.calculateScore(borrower2.address, 650); // Gold - 24h
      await reputationScorer.calculateScore(owner.address, 300);      // Bronze - 0h

      // Create 3 unhealthy loans
      for (let i = 1; i <= 3; i++) {
        const borrower = i === 1 ? borrower1.address :
                         i === 2 ? borrower2.address :
                         owner.address;

        await lendingPool.setLoan(
          i,
          borrower,
          ethers.parseEther("1"),
          ethers.parseEther("0.95"),
          true
        );

        await healthMonitor.calculateHealthFactor(borrower, i);
        await liquidator.startLiquidation(i);
      }

      // Verify different grace periods
      const grace1 = await liquidator.getGracePeriodRemaining(0); // Platinum
      const grace2 = await liquidator.getGracePeriodRemaining(1); // Gold
      const grace3 = await liquidator.getGracePeriodRemaining(2); // Bronze

      expect(grace1).to.be.closeTo(72 * 60 * 60, 10);
      expect(grace2).to.be.closeTo(24 * 60 * 60, 10);
      expect(grace3).to.equal(0);

      // Bronze can be liquidated immediately
      await liquidator.connect(liquidatorUser).executeLiquidation(2);
      const auction3 = await liquidator.getAuction(2);
      expect(auction3.executed).to.be.true;

      // Gold needs 24h
      await expect(
        liquidator.connect(liquidatorUser).executeLiquidation(1)
      ).to.be.revertedWith("Grace period active");

      // After 24h, Gold can be liquidated
      await time.increase(24 * 60 * 60);
      await liquidator.connect(liquidatorUser).executeLiquidation(1);

      // Platinum still protected
      await expect(
        liquidator.connect(liquidatorUser).executeLiquidation(0)
      ).to.be.revertedWith("Grace period active");
    });
  });

  describe("Scenario 6: Score Improvement Over Time", function () {
    it("Should show progressive score improvement", async function () {
      // Month 1: New user, Bronze tier
      await reputationScorer.calculateScore(borrower1.address, 200);
      let score = await reputationScorer.scores(borrower1.address);
      expect(score.tier).to.equal("Bronze");

      // Month 2-4: Build payment history
      for (let i = 1; i <= 12; i++) {
        await reputationScorer.recordPayment(
          borrower1.address,
          i,
          ethers.parseEther("0.5"),
          Math.floor(Date.now() / 1000),
          true
        );
      }

      // Month 4: Score improves to Silver
      await reputationScorer.calculateScore(borrower1.address, 400);
      score = await reputationScorer.scores(borrower1.address);
      expect(score.tier).to.equal("Silver");
      expect(score.ltv).to.equal(65);

      // Month 6: Temporal score improves
      await reputationScorer.calculateScore(borrower1.address, 600);
      score = await reputationScorer.scores(borrower1.address);
      expect(score.tier).to.equal("Gold");
      expect(score.ltv).to.equal(75);

      // Month 12: Reaches Platinum
      await reputationScorer.calculateScore(borrower1.address, 800);
      score = await reputationScorer.scores(borrower1.address);
      expect(score.tier).to.equal("Platinum");
      expect(score.ltv).to.equal(90);
    });
  });
});
