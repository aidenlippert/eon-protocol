import { expect } from "chai";
import { ethers } from "hardhat";
import {
  HealthFactorMonitor,
  ReputationScorer,
  MockLendingPool,
  MockERC20
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HealthFactorMonitor", function () {
  let healthMonitor: HealthFactorMonitor;
  let reputationScorer: ReputationScorer;
  let lendingPool: MockLendingPool;
  let mockOracle: SignerWithAddress;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let other: SignerWithAddress;

  const LIQUIDATION_THRESHOLD = ethers.parseEther("0.95"); // 95%

  beforeEach(async function () {
    [owner, borrower, other, mockOracle] = await ethers.getSigners();

    // Deploy ReputationScorer
    const ReputationScorerFactory = await ethers.getContractFactory("ReputationScorer");
    reputationScorer = await ReputationScorerFactory.deploy();

    // Deploy MockLendingPool
    const MockLendingPoolFactory = await ethers.getContractFactory("MockLendingPool");
    lendingPool = await MockLendingPoolFactory.deploy();

    // Deploy HealthFactorMonitor
    const HealthMonitorFactory = await ethers.getContractFactory("HealthFactorMonitor");
    healthMonitor = await HealthMonitorFactory.deploy(
      await reputationScorer.getAddress(),
      await lendingPool.getAddress(),
      mockOracle.address
    );

    // Authorize HealthFactorMonitor to update scores
    await reputationScorer.setAuthorizedUpdater(await healthMonitor.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await healthMonitor.reputationScorer()).to.equal(
        await reputationScorer.getAddress()
      );
      expect(await healthMonitor.lendingPool()).to.equal(
        await lendingPool.getAddress()
      );
      expect(await healthMonitor.priceOracle()).to.equal(mockOracle.address);
    });

    it("Should set the correct liquidation threshold", async function () {
      expect(await healthMonitor.LIQUIDATION_THRESHOLD()).to.equal(LIQUIDATION_THRESHOLD);
    });

    it("Should set the owner correctly", async function () {
      expect(await healthMonitor.owner()).to.equal(owner.address);
    });
  });

  describe("Health Factor Calculation", function () {
    beforeEach(async function () {
      // Setup borrower with Silver tier (65% LTV)
      await reputationScorer.calculateScore(borrower.address, 500);
      expect(await reputationScorer.getDynamicLTV(borrower.address)).to.equal(65);
    });

    it("Should calculate correct health factor for healthy loan", async function () {
      // Loan: 1 ETH collateral, 0.5 ETH debt
      // Silver tier: 65% LTV
      // Health Factor = (1 * 0.65) / 0.5 = 1.3
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(healthStatus.healthFactor).to.equal(ethers.parseEther("1.3"));
      expect(healthStatus.liquidatable).to.be.false;
    });

    it("Should calculate correct health factor for unhealthy loan", async function () {
      // Loan: 1 ETH collateral, 0.7 ETH debt
      // Silver tier: 65% LTV
      // Health Factor = (1 * 0.65) / 0.7 ≈ 0.928
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.7"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);

      // Allow small rounding difference
      expect(healthStatus.healthFactor).to.be.closeTo(
        ethers.parseEther("0.928571428571428571"),
        ethers.parseEther("0.001")
      );
      expect(healthStatus.liquidatable).to.be.true;
    });

    it("Should handle edge case: exact liquidation threshold", async function () {
      // Loan: 1 ETH collateral, debt calculated to hit exactly 0.95 HF
      // HF = (1 * 0.65) / debt = 0.95
      // debt = 0.65 / 0.95 ≈ 0.684210526315789474
      const debt = ethers.parseEther("0.684210526315789474");

      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        debt,
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(healthStatus.healthFactor).to.be.closeTo(
        LIQUIDATION_THRESHOLD,
        ethers.parseEther("0.001")
      );
      // Should be liquidatable when HF <= threshold
      expect(healthStatus.liquidatable).to.be.true;
    });

    it("Should handle zero debt (infinite health factor)", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        0,
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);

      // Should return max uint256 for infinite health factor
      expect(healthStatus.healthFactor).to.equal(ethers.MaxUint256);
      expect(healthStatus.liquidatable).to.be.false;
    });

    it("Should handle zero collateral (zero health factor)", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        0,
        ethers.parseEther("1"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(healthStatus.healthFactor).to.equal(0);
      expect(healthStatus.liquidatable).to.be.true;
    });

    it("Should update health factor when called multiple times", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      // First calculation
      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      let healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);
      expect(healthStatus.healthFactor).to.equal(ethers.parseEther("1.3"));

      // Update loan (increase debt)
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.65"),
        true
      );

      // Second calculation
      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      healthStatus = await healthMonitor.getHealthStatus(borrower.address, 1);
      expect(healthStatus.healthFactor).to.equal(ethers.parseEther("1.0"));
    });

    it("Should emit HealthFactorUpdated event", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await expect(healthMonitor.calculateHealthFactor(borrower.address, 1))
        .to.emit(healthMonitor, "HealthFactorUpdated")
        .withArgs(borrower.address, 1, ethers.parseEther("1.3"), false);
    });

    it("Should revert for inactive loan", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        false // inactive
      );

      await expect(
        healthMonitor.calculateHealthFactor(borrower.address, 1)
      ).to.be.revertedWith("Loan not active");
    });
  });

  describe("Risk Level Classification", function () {
    beforeEach(async function () {
      // Silver tier: 65% LTV
      await reputationScorer.calculateScore(borrower.address, 500);
    });

    it("Should classify Safe risk level (HF >= 1.2)", async function () {
      // HF = 1.3 (Safe)
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const riskLevel = await healthMonitor.getRiskLevel(borrower.address, 1);

      expect(riskLevel).to.equal(0); // Safe
    });

    it("Should classify Warning risk level (1.05 <= HF < 1.2)", async function () {
      // HF = 1.08 (Warning)
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.6"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const riskLevel = await healthMonitor.getRiskLevel(borrower.address, 1);

      expect(riskLevel).to.equal(1); // Warning
    });

    it("Should classify Danger risk level (0.95 < HF < 1.05)", async function () {
      // HF = 1.0 (Danger)
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.65"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const riskLevel = await healthMonitor.getRiskLevel(borrower.address, 1);

      expect(riskLevel).to.equal(2); // Danger
    });

    it("Should classify Critical risk level (HF <= 0.95)", async function () {
      // HF = 0.928 (Critical)
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.7"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const riskLevel = await healthMonitor.getRiskLevel(borrower.address, 1);

      expect(riskLevel).to.equal(3); // Critical
    });
  });

  describe("Liquidation Status", function () {
    beforeEach(async function () {
      await reputationScorer.calculateScore(borrower.address, 500);
    });

    it("Should return false for healthy loan", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      expect(await healthMonitor.isLiquidatable(borrower.address, 1)).to.be.false;
    });

    it("Should return true for unhealthy loan", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.7"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      expect(await healthMonitor.isLiquidatable(borrower.address, 1)).to.be.true;
    });

    it("Should return true when HF equals threshold", async function () {
      const debt = ethers.parseEther("0.684210526315789474");
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        debt,
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      expect(await healthMonitor.isLiquidatable(borrower.address, 1)).to.be.true;
    });
  });

  describe("Required Collateral Calculation", function () {
    beforeEach(async function () {
      await reputationScorer.calculateScore(borrower.address, 500);
    });

    it("Should calculate required collateral to reach target HF", async function () {
      // Current: 1 ETH collateral, 0.7 ETH debt, HF ≈ 0.928
      // Want: HF = 1.2
      // Required total collateral: (collateral * 0.65) / 0.7 = 1.2 → collateral = (1.2 * 0.7) / 0.65 ≈ 1.292
      // Additional collateral needed: 1.292 - 1.0 = 0.292
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.7"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const additionalRequired = await healthMonitor.getRequiredCollateral(
        borrower.address,
        1,
        ethers.parseEther("1.2")
      );

      // Should return ADDITIONAL collateral needed (not total)
      expect(additionalRequired).to.be.closeTo(
        ethers.parseEther("0.292307692307692308"),
        ethers.parseEther("0.001")
      );
    });

    it("Should return 0 when current HF already exceeds target", async function () {
      // Current HF = 1.3, target HF = 1.0
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const required = await healthMonitor.getRequiredCollateral(
        borrower.address,
        1,
        ethers.parseEther("1.0")
      );

      expect(required).to.equal(0);
    });

    it("Should handle zero debt case", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        0,
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const required = await healthMonitor.getRequiredCollateral(
        borrower.address,
        1,
        ethers.parseEther("1.2")
      );

      expect(required).to.equal(0);
    });
  });

  describe("Batch Health Factor Updates", function () {
    it("Should calculate health factors for multiple loans", async function () {
      // Setup multiple borrowers and loans
      await reputationScorer.calculateScore(borrower.address, 500); // Silver
      await reputationScorer.calculateScore(other.address, 700);    // Gold

      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await lendingPool.setLoan(
        2,
        other.address,
        ethers.parseEther("2"),
        ethers.parseEther("1"),
        true
      );

      // Calculate both
      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      await healthMonitor.calculateHealthFactor(other.address, 2);

      // Verify both
      const health1 = await healthMonitor.getHealthStatus(borrower.address, 1);
      const health2 = await healthMonitor.getHealthStatus(other.address, 2);

      expect(health1.healthFactor).to.equal(ethers.parseEther("1.3")); // Silver 65%
      expect(health2.healthFactor).to.equal(ethers.parseEther("1.5")); // Gold 75%
    });

    it("Should handle concurrent loans for same borrower", async function () {
      await reputationScorer.calculateScore(borrower.address, 500);

      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await lendingPool.setLoan(
        2,
        borrower.address,
        ethers.parseEther("2"),
        ethers.parseEther("1.2"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      await healthMonitor.calculateHealthFactor(borrower.address, 2);

      const health1 = await healthMonitor.getHealthStatus(borrower.address, 1);
      const health2 = await healthMonitor.getHealthStatus(borrower.address, 2);

      expect(health1.healthFactor).to.equal(ethers.parseEther("1.3"));
      expect(health2.healthFactor).to.be.closeTo(
        ethers.parseEther("1.083333333333333333"),
        ethers.parseEther("0.001")
      );
    });
  });

  describe("Different Reputation Tiers", function () {
    it("Should use Bronze tier LTV (50%)", async function () {
      await reputationScorer.calculateScore(borrower.address, 200); // Bronze
      expect(await reputationScorer.getDynamicLTV(borrower.address)).to.equal(50);

      // HF = (1 * 0.50) / 0.5 = 1.0
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.0"));
    });

    it("Should use Silver tier LTV (65%)", async function () {
      await reputationScorer.calculateScore(borrower.address, 500); // Silver
      expect(await reputationScorer.getDynamicLTV(borrower.address)).to.equal(65);

      // HF = (1 * 0.65) / 0.5 = 1.3
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.3"));
    });

    it("Should use Gold tier LTV (75%)", async function () {
      await reputationScorer.calculateScore(borrower.address, 700); // Gold
      expect(await reputationScorer.getDynamicLTV(borrower.address)).to.equal(75);

      // HF = (1 * 0.75) / 0.5 = 1.5
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.5"));
    });

    it("Should use Platinum tier LTV (90%)", async function () {
      await reputationScorer.calculateScore(borrower.address, 850); // Platinum
      expect(await reputationScorer.getDynamicLTV(borrower.address)).to.equal(90);

      // HF = (1 * 0.90) / 0.5 = 1.8
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.8"));
    });
  });

  describe("Authorization", function () {
    it("Should allow owner to update oracle address", async function () {
      const newOracle = other.address;
      await healthMonitor.updateOracle(newOracle);
      expect(await healthMonitor.priceOracle()).to.equal(newOracle);
    });

    it("Should prevent non-owner from updating oracle", async function () {
      await expect(
        healthMonitor.connect(other).updateOracle(other.address)
      ).to.be.revertedWithCustomError(healthMonitor, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update liquidation threshold", async function () {
      const newThreshold = ethers.parseEther("0.9");
      await healthMonitor.updateLiquidationThreshold(newThreshold);
      expect(await healthMonitor.LIQUIDATION_THRESHOLD()).to.equal(newThreshold);
    });

    it("Should prevent non-owner from updating threshold", async function () {
      await expect(
        healthMonitor.connect(other).updateLiquidationThreshold(ethers.parseEther("0.9"))
      ).to.be.revertedWithCustomError(healthMonitor, "OwnableUnauthorizedAccount");
    });

    it("Should reject invalid threshold (> 100%)", async function () {
      await expect(
        healthMonitor.updateLiquidationThreshold(ethers.parseEther("1.1"))
      ).to.be.revertedWith("Invalid threshold");
    });

    it("Should reject zero threshold", async function () {
      await expect(
        healthMonitor.updateLiquidationThreshold(0)
      ).to.be.revertedWith("Invalid threshold");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large collateral amounts", async function () {
      await reputationScorer.calculateScore(borrower.address, 500);

      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1000000"),
        ethers.parseEther("500000"),
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.3"));
    });

    it("Should handle very small amounts (wei)", async function () {
      await reputationScorer.calculateScore(borrower.address, 500);

      await lendingPool.setLoan(
        1,
        borrower.address,
        1000,
        500,
        true
      );

      await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(ethers.parseEther("1.3"));
    });

    it("Should handle loan with no health factor calculated yet", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      // Don't calculate health factor
      const health = await healthMonitor.getHealthStatus(borrower.address, 1);

      expect(health.healthFactor).to.equal(0);
      expect(health.lastUpdate).to.equal(0);
      expect(health.liquidatable).to.be.false;
    });
  });

  describe("Events", function () {
    beforeEach(async function () {
      await reputationScorer.calculateScore(borrower.address, 500);
    });

    it("Should emit HealthFactorUpdated on calculation", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.5"),
        true
      );

      await expect(healthMonitor.calculateHealthFactor(borrower.address, 1))
        .to.emit(healthMonitor, "HealthFactorUpdated")
        .withArgs(borrower.address, 1, ethers.parseEther("1.3"), false);
    });

    it("Should emit with liquidatable = true for unhealthy loan", async function () {
      await lendingPool.setLoan(
        1,
        borrower.address,
        ethers.parseEther("1"),
        ethers.parseEther("0.7"),
        true
      );

      const tx = await healthMonitor.calculateHealthFactor(borrower.address, 1);
      const receipt = await tx.wait();

      const event = receipt?.logs.find(
        (log: any) => {
          try {
            return healthMonitor.interface.parseLog(log)?.name === "HealthFactorUpdated";
          } catch {
            return false;
          }
        }
      );

      expect(event).to.not.be.undefined;
      const parsedEvent = healthMonitor.interface.parseLog(event!);
      expect(parsedEvent?.args.liquidatable).to.be.true;
    });

    it("Should emit OracleUpdated when oracle changes", async function () {
      await expect(healthMonitor.updateOracle(other.address))
        .to.emit(healthMonitor, "OracleUpdated")
        .withArgs(other.address);
    });

    it("Should emit ThresholdUpdated when threshold changes", async function () {
      const newThreshold = ethers.parseEther("0.9");
      await expect(healthMonitor.updateLiquidationThreshold(newThreshold))
        .to.emit(healthMonitor, "ThresholdUpdated")
        .withArgs(newThreshold);
    });
  });
});
