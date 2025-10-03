import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ReputationScorer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ReputationScorer", function () {
  let reputationScorer: ReputationScorer;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let lendingPool: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2, lendingPool] = await ethers.getSigners();

    const ReputationScorerFactory = await ethers.getContractFactory("ReputationScorer");
    reputationScorer = await ReputationScorerFactory.deploy();
    await reputationScorer.waitForDeployment();

    // Authorize lending pool to update scores
    await reputationScorer.setAuthorizedUpdater(lendingPool.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await reputationScorer.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct weights", async function () {
      expect(await reputationScorer.BASE_WEIGHT()).to.equal(50);
      expect(await reputationScorer.PAYMENT_WEIGHT()).to.equal(30);
      expect(await reputationScorer.WALLET_AGE_WEIGHT()).to.equal(10);
      expect(await reputationScorer.PROTOCOL_WEIGHT()).to.equal(10);
    });
  });

  describe("Score Calculation", function () {
    it("Should calculate score with base score only", async function () {
      const baseScore = 800;

      await reputationScorer.connect(lendingPool).calculateScore(user1.address, baseScore);

      const score = await reputationScorer.scores(user1.address);
      expect(score.baseScore).to.equal(baseScore);
      expect(score.totalScore).to.be.gte(0);
      expect(score.totalScore).to.be.lte(1000);
    });

    it("Should assign correct tier based on score", async function () {
      // Test Platinum tier (800+)
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 900);
      expect(await reputationScorer.getCreditTier(user1.address)).to.equal("Platinum");

      // Test Gold tier (600-799)
      await reputationScorer.connect(lendingPool).calculateScore(user2.address, 700);
      expect(await reputationScorer.getCreditTier(user2.address)).to.equal("Gold");
    });

    it("Should assign correct LTV based on score", async function () {
      // Platinum (800+) → 90% LTV
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 850);
      expect(await reputationScorer.getDynamicLTV(user1.address)).to.equal(90);

      // Gold (600-799) → 75% LTV
      await reputationScorer.connect(lendingPool).calculateScore(user2.address, 650);
      expect(await reputationScorer.getDynamicLTV(user2.address)).to.equal(75);
    });

    it("Should reject score > 1000", async function () {
      await expect(
        reputationScorer.connect(lendingPool).calculateScore(user1.address, 1001)
      ).to.be.revertedWith("Base score exceeds maximum");
    });

    it("Should only allow authorized updaters", async function () {
      await expect(
        reputationScorer.connect(user1).calculateScore(user1.address, 500)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Payment History", function () {
    it("Should record payment correctly", async function () {
      const loanId = 1;
      const amount = ethers.parseEther("100");
      const dueDate = Math.floor(Date.now() / 1000);

      await reputationScorer.connect(lendingPool).recordPayment(
        user1.address,
        loanId,
        amount,
        dueDate,
        true // on time
      );

      const history = await reputationScorer.getPaymentHistory(user1.address);
      expect(history.length).to.equal(1);
      expect(history[0].loanId).to.equal(loanId);
      expect(history[0].onTime).to.be.true;
    });

    it("Should calculate late days correctly", async function () {
      const loanId = 1;
      const amount = ethers.parseEther("100");

      // Use block.timestamp for accurate calculation
      const currentTime = await time.latest();
      const dueDate = currentTime - (5 * 24 * 60 * 60); // 5 days ago

      await reputationScorer.connect(lendingPool).recordPayment(
        user1.address,
        loanId,
        amount,
        dueDate,
        false // late
      );

      const history = await reputationScorer.getPaymentHistory(user1.address);
      expect(history[0].lateDays).to.equal(5);
    });

    it("Should improve score with on-time payments", async function () {
      // Initial score
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 500);
      const initialScore = await reputationScorer.scores(user1.address);

      // Record 12 on-time payments
      for (let i = 0; i < 12; i++) {
        await reputationScorer.connect(lendingPool).recordPayment(
          user1.address,
          i + 1,
          ethers.parseEther("100"),
          Math.floor(Date.now() / 1000),
          true
        );
      }

      // Recalculate score
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 500);
      const newScore = await reputationScorer.scores(user1.address);

      expect(newScore.paymentScore).to.be.gt(initialScore.paymentScore);
    });

    it("Should penalize score with late payments", async function () {
      // Record mix of on-time and late payments
      for (let i = 0; i < 6; i++) {
        await reputationScorer.connect(lendingPool).recordPayment(
          user1.address,
          i + 1,
          ethers.parseEther("100"),
          Math.floor(Date.now() / 1000),
          true // on time
        );
      }

      for (let i = 6; i < 12; i++) {
        await reputationScorer.connect(lendingPool).recordPayment(
          user1.address,
          i + 1,
          ethers.parseEther("100"),
          Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60), // 10 days late
          false
        );
      }

      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 500);
      const score = await reputationScorer.scores(user1.address);

      // Payment score should be reduced (50% on-time rate)
      expect(score.paymentScore).to.be.lt(150);
    });
  });

  describe("Wallet Age Scoring", function () {
    it("Should record wallet creation time", async function () {
      await reputationScorer.connect(lendingPool).recordWalletCreation(user1.address);

      const creationTime = await reputationScorer.walletCreationTime(user1.address);
      expect(creationTime).to.be.gt(0);
    });

    it("Should only record creation time once", async function () {
      await reputationScorer.connect(lendingPool).recordWalletCreation(user1.address);
      const firstTime = await reputationScorer.walletCreationTime(user1.address);

      // Try to record again
      await reputationScorer.connect(lendingPool).recordWalletCreation(user1.address);
      const secondTime = await reputationScorer.walletCreationTime(user1.address);

      expect(firstTime).to.equal(secondTime);
    });
  });

  describe("Protocol Activity", function () {
    it("Should increment interaction count", async function () {
      await reputationScorer.connect(lendingPool).incrementProtocolInteractions(user1.address);
      await reputationScorer.connect(lendingPool).incrementProtocolInteractions(user1.address);

      const count = await reputationScorer.protocolInteractions(user1.address);
      expect(count).to.equal(2);
    });

    it("Should max out protocol score at 100 interactions", async function () {
      // Record 100+ interactions
      for (let i = 0; i < 120; i++) {
        await reputationScorer.connect(lendingPool).incrementProtocolInteractions(user1.address);
      }

      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 500);
      const score = await reputationScorer.scores(user1.address);

      expect(score.protocolScore).to.equal(100);
    });
  });

  describe("Score Breakdown", function () {
    it("Should return complete score breakdown", async function () {
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 600);

      const breakdown = await reputationScorer.getScoreBreakdown(user1.address);

      expect(breakdown.baseScore).to.equal(600);
      expect(breakdown.paymentScore).to.be.gte(0);
      expect(breakdown.walletAgeScore).to.be.gte(0);
      expect(breakdown.protocolScore).to.be.gte(0);
      expect(breakdown.totalScore).to.be.gte(0);
      expect(breakdown.lastUpdated).to.be.gt(0);
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to set authorized updater", async function () {
      await reputationScorer.setAuthorizedUpdater(user1.address, true);
      expect(await reputationScorer.authorizedUpdaters(user1.address)).to.be.true;
    });

    it("Should prevent non-owner from setting authorized updater", async function () {
      await expect(
        reputationScorer.connect(user1).setAuthorizedUpdater(user2.address, true)
      ).to.be.reverted;
    });

    it("Should emit event when setting authorized updater", async function () {
      await expect(reputationScorer.setAuthorizedUpdater(user1.address, true))
        .to.emit(reputationScorer, "AuthorizedUpdaterSet")
        .withArgs(user1.address, true);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero base score", async function () {
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 0);

      const score = await reputationScorer.scores(user1.address);
      expect(score.baseScore).to.equal(0);
      expect(score.tier).to.equal("Bronze");
      expect(score.ltv).to.equal(50);
    });

    it("Should handle maximum base score", async function () {
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 1000);

      const score = await reputationScorer.scores(user1.address);
      expect(score.baseScore).to.equal(1000);
      expect(score.tier).to.equal("Platinum");
      expect(score.ltv).to.equal(90);
    });

    it("Should handle user with no payment history", async function () {
      await reputationScorer.connect(lendingPool).calculateScore(user1.address, 500);

      const score = await reputationScorer.scores(user1.address);
      // Should have neutral payment score (100)
      expect(score.paymentScore).to.equal(100);
    });
  });

  describe("Events", function () {
    it("Should emit ScoreUpdated event", async function () {
      const baseScore = 700;
      const tx = await reputationScorer.connect(lendingPool).calculateScore(user1.address, baseScore);

      // After transaction, check the event was emitted with correct values
      await expect(tx)
        .to.emit(reputationScorer, "ScoreUpdated")
        .withArgs(
          user1.address,
          700, // totalScore = baseScore for Phase 1
          700, // baseScore
          100, // paymentScore (neutral for new user)
          0,   // walletAgeScore (new user)
          0    // protocolScore (no activity yet)
        );
    });

    it("Should emit PaymentRecorded event", async function () {
      await expect(
        reputationScorer.connect(lendingPool).recordPayment(
          user1.address,
          1,
          ethers.parseEther("100"),
          Math.floor(Date.now() / 1000),
          true
        )
      )
        .to.emit(reputationScorer, "PaymentRecorded")
        .withArgs(user1.address, 1, true, 0);
    });
  });
});
