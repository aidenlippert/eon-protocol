import { expect } from "chai";
import { ethers } from "hardhat";
import { DutchAuctionLiquidator, ReputationScorer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DutchAuctionLiquidator", function () {
  let liquidator: DutchAuctionLiquidator;
  let reputationScorer: ReputationScorer;
  let mockLendingPool: any;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let liquidatorUser: SignerWithAddress;

  beforeEach(async function () {
    [owner, borrower, liquidatorUser] = await ethers.getSigners();

    // Deploy ReputationScorer
    const ReputationScorerFactory = await ethers.getContractFactory("ReputationScorer");
    reputationScorer = await ReputationScorerFactory.deploy();
    await reputationScorer.waitForDeployment();

    // Deploy mock lending pool (simplified for testing)
    const MockLendingPoolFactory = await ethers.getContractFactory("MockLendingPool");
    mockLendingPool = await MockLendingPoolFactory.deploy();
    await mockLendingPool.waitForDeployment();

    // Deploy liquidator
    const LiquidatorFactory = await ethers.getContractFactory("DutchAuctionLiquidator");
    liquidator = await LiquidatorFactory.deploy(
      await reputationScorer.getAddress(),
      await mockLendingPool.getAddress()
    );
    await liquidator.waitForDeployment();

    // Setup: Authorize liquidator to update scores
    await reputationScorer.setAuthorizedUpdater(await liquidator.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set correct addresses", async function () {
      expect(await liquidator.reputationScorer()).to.equal(await reputationScorer.getAddress());
      expect(await liquidator.lendingPool()).to.equal(await mockLendingPool.getAddress());
    });

    it("Should set correct grace period constants", async function () {
      expect(await liquidator.PLATINUM_GRACE_PERIOD()).to.equal(72 * 60 * 60); // 72 hours
      expect(await liquidator.GOLD_GRACE_PERIOD()).to.equal(24 * 60 * 60);     // 24 hours
      expect(await liquidator.SILVER_GRACE_PERIOD()).to.equal(0);
      expect(await liquidator.BRONZE_GRACE_PERIOD()).to.equal(0);
    });

    it("Should set correct auction parameters", async function () {
      expect(await liquidator.AUCTION_DURATION()).to.equal(6 * 60 * 60); // 6 hours
      expect(await liquidator.MAX_DISCOUNT_BPS()).to.equal(2000);         // 20%
    });
  });

  describe("Grace Period Calculation", function () {
    it("Should give 72h grace period for Platinum tier (800+)", async function () {
      // Set borrower score to 850 (Platinum)
      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 850);

      const gracePeriod = await liquidator.getGracePeriod(borrower.address);
      expect(gracePeriod).to.equal(72 * 60 * 60);
    });

    it("Should give 24h grace period for Gold tier (600-799)", async function () {
      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 700);

      const gracePeriod = await liquidator.getGracePeriod(borrower.address);
      expect(gracePeriod).to.equal(24 * 60 * 60);
    });

    it("Should give 0h grace period for Silver tier (400-599)", async function () {
      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 500);

      const gracePeriod = await liquidator.getGracePeriod(borrower.address);
      expect(gracePeriod).to.equal(0);
    });

    it("Should give 0h grace period for Bronze tier (<400)", async function () {
      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 300);

      const gracePeriod = await liquidator.getGracePeriod(borrower.address);
      expect(gracePeriod).to.equal(0);
    });
  });

  describe("Starting Liquidation", function () {
    beforeEach(async function () {
      // Setup mock loan
      await mockLendingPool.setLoan(
        1, // loanId
        borrower.address,
        ethers.parseEther("1"), // collateral
        ethers.parseEther("0.8"), // borrowed
        true // active
      );

      // Set borrower score
      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 700); // Gold tier
    });

    it("Should start auction with correct grace period", async function () {
      const tx = await liquidator.startLiquidation(1);
      const receipt = await tx.wait();

      const auctionId = 0; // First auction
      const auction = await liquidator.getAuction(auctionId);

      expect(auction.loanId).to.equal(1);
      expect(auction.borrower).to.equal(borrower.address);
      expect(auction.debtAmount).to.equal(ethers.parseEther("0.8"));
      expect(auction.collateralAmount).to.equal(ethers.parseEther("1"));
      expect(auction.executed).to.be.false;
    });

    it("Should emit AuctionStarted event", async function () {
      await expect(liquidator.startLiquidation(1))
        .to.emit(liquidator, "AuctionStarted");
    });

    it("Should reject inactive loan", async function () {
      await mockLendingPool.setLoan(
        2,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        false // inactive
      );

      await expect(liquidator.startLiquidation(2))
        .to.be.revertedWith("Loan not active");
    });
  });

  describe("Discount Calculation", function () {
    let auctionId: number;

    beforeEach(async function () {
      // Setup and start auction
      await mockLendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 500); // Silver (0h grace)

      await liquidator.startLiquidation(1);
      auctionId = 0;
    });

    it("Should have 0% discount at auction start", async function () {
      const discount = await liquidator.getCurrentDiscount(auctionId);
      expect(discount).to.equal(0);
    });

    it("Should have ~10% discount after 3 hours", async function () {
      await time.increase(3 * 60 * 60); // 3 hours

      const discount = await liquidator.getCurrentDiscount(auctionId);
      expect(discount).to.be.closeTo(1000, 50); // ~10% (1000 bps) ± 50
    });

    it("Should have 20% discount after 6 hours", async function () {
      await time.increase(6 * 60 * 60); // 6 hours

      const discount = await liquidator.getCurrentDiscount(auctionId);
      expect(discount).to.equal(2000); // 20%
    });

    it("Should cap at 20% discount after auction ends", async function () {
      await time.increase(10 * 60 * 60); // 10 hours

      const discount = await liquidator.getCurrentDiscount(auctionId);
      expect(discount).to.equal(2000); // Still 20%
    });

    it("Should respect grace period before starting discount", async function () {
      // Start new auction with Gold tier (24h grace)
      await reputationScorer.calculateScore(borrower.address, 700);

      await mockLendingPool.setLoan(
        2,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await liquidator.startLiquidation(2);
      const newAuctionId = 1;

      // During grace period
      await time.increase(12 * 60 * 60); // 12 hours
      let discount = await liquidator.getCurrentDiscount(newAuctionId);
      expect(discount).to.equal(0); // Still in grace period

      // After grace period
      await time.increase(12 * 60 * 60); // Another 12 hours (24h total)
      discount = await liquidator.getCurrentDiscount(newAuctionId);
      expect(discount).to.equal(0); // Just ended grace period, auction starts now

      // 3 hours into auction
      await time.increase(3 * 60 * 60);
      discount = await liquidator.getCurrentDiscount(newAuctionId);
      expect(discount).to.be.closeTo(1000, 50); // ~10%
    });
  });

  describe("Executing Liquidation", function () {
    let auctionId: number;

    beforeEach(async function () {
      await mockLendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 500); // 0h grace

      await liquidator.startLiquidation(1);
      auctionId = 0;
    });

    it("Should execute liquidation after grace period", async function () {
      await liquidator.connect(liquidatorUser).executeLiquidation(auctionId);

      const auction = await liquidator.getAuction(auctionId);
      expect(auction.executed).to.be.true;
      expect(auction.executor).to.equal(liquidatorUser.address);
    });

    it("Should reject execution during grace period", async function () {
      // Start auction with Gold tier (24h grace)
      await reputationScorer.calculateScore(borrower.address, 700);

      await mockLendingPool.setLoan(
        2,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await liquidator.startLiquidation(2);

      await expect(
        liquidator.connect(liquidatorUser).executeLiquidation(1)
      ).to.be.revertedWith("Grace period active");
    });

    it("Should reject double execution", async function () {
      await liquidator.connect(liquidatorUser).executeLiquidation(auctionId);

      await expect(
        liquidator.connect(liquidatorUser).executeLiquidation(auctionId)
      ).to.be.revertedWith("Auction already executed");
    });

    it("Should emit AuctionExecuted event", async function () {
      await expect(liquidator.connect(liquidatorUser).executeLiquidation(auctionId))
        .to.emit(liquidator, "AuctionExecuted");
    });
  });

  describe("Auction Cancellation", function () {
    let auctionId: number;

    beforeEach(async function () {
      await mockLendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 500);

      await liquidator.startLiquidation(1);
      auctionId = 0;
    });

    it("Should allow owner to cancel auction", async function () {
      await liquidator.cancelAuction(auctionId, "Loan repaid");

      const auction = await liquidator.getAuction(auctionId);
      expect(auction.executed).to.be.true;
    });

    it("Should prevent non-owner from canceling", async function () {
      await expect(
        liquidator.connect(liquidatorUser).cancelAuction(auctionId, "Reason")
      ).to.be.reverted;
    });

    it("Should emit AuctionCancelled event", async function () {
      await expect(liquidator.cancelAuction(auctionId, "Loan repaid"))
        .to.emit(liquidator, "AuctionCancelled")
        .withArgs(auctionId, "Loan repaid");
    });
  });

  describe("Executable Check", function () {
    let auctionId: number;

    beforeEach(async function () {
      await mockLendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 700); // 24h grace

      await liquidator.startLiquidation(1);
      auctionId = 0;
    });

    it("Should return false during grace period", async function () {
      const executable = await liquidator.isExecutable(auctionId);
      expect(executable).to.be.false;
    });

    it("Should return true after grace period", async function () {
      await time.increase(24 * 60 * 60); // 24 hours

      const executable = await liquidator.isExecutable(auctionId);
      expect(executable).to.be.true;
    });

    it("Should return false after execution", async function () {
      await time.increase(24 * 60 * 60);
      await liquidator.connect(liquidatorUser).executeLiquidation(auctionId);

      const executable = await liquidator.isExecutable(auctionId);
      expect(executable).to.be.false;
    });
  });

  describe("Grace Period Remaining", function () {
    let auctionId: number;

    beforeEach(async function () {
      await mockLendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.8"),
        true
      );

      await reputationScorer.setAuthorizedUpdater(owner.address, true);
      await reputationScorer.calculateScore(borrower.address, 850); // 72h grace

      await liquidator.startLiquidation(1);
      auctionId = 0;
    });

    it("Should show correct time remaining", async function () {
      const remaining = await liquidator.getGracePeriodRemaining(auctionId);
      expect(remaining).to.be.closeTo(72 * 60 * 60, 10); // ~72 hours ± 10 seconds
    });

    it("Should return 0 after grace period ends", async function () {
      await time.increase(72 * 60 * 60); // 72 hours

      const remaining = await liquidator.getGracePeriodRemaining(auctionId);
      expect(remaining).to.equal(0);
    });
  });
});
