import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { LiquidationEngineV1 } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LiquidationEngineV1", function () {
  let liquidationEngine: LiquidationEngineV1;
  let owner: SignerWithAddress;
  let borrower: SignerWithAddress;
  let liquidator: SignerWithAddress;

  const LIQUIDATION_BONUS = ethers.parseEther("0.07"); // 7%
  const MIN_HEALTH_FACTOR = ethers.parseEther("1"); // 1.0
  const GRACE_PERIOD = 24 * 60 * 60; // 24 hours

  beforeEach(async function () {
    [owner, borrower, liquidator] = await ethers.getSigners();

    const LiquidationEngineFactory = await ethers.getContractFactory(
      "LiquidationEngineV1"
    );

    liquidationEngine = (await upgrades.deployProxy(
      LiquidationEngineFactory,
      [LIQUIDATION_BONUS],
      { initializer: "initialize" }
    )) as unknown as LiquidationEngineV1;

    await liquidationEngine.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct liquidation bonus", async function () {
      expect(await liquidationEngine.liquidationBonus()).to.equal(
        LIQUIDATION_BONUS
      );
    });

    it("Should set correct owner", async function () {
      expect(await liquidationEngine.owner()).to.equal(owner.address);
    });

    it("Should reject invalid liquidation bonus", async function () {
      const LiquidationEngineFactory = await ethers.getContractFactory(
        "LiquidationEngineV1"
      );

      // Too low (< 5%)
      await expect(
        upgrades.deployProxy(
          LiquidationEngineFactory,
          [ethers.parseEther("0.04")],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(liquidationEngine, "InvalidConfiguration");

      // Too high (> 10%)
      await expect(
        upgrades.deployProxy(
          LiquidationEngineFactory,
          [ethers.parseEther("0.11")],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(liquidationEngine, "InvalidConfiguration");
    });
  });

  describe("Health Factor Calculation", function () {
    it("Should return infinite health factor for zero debt", async function () {
      const healthFactor = await liquidationEngine.calculateHealthFactor(
        borrower.address
      );
      expect(healthFactor).to.equal(ethers.MaxUint256);
    });

    it("Should calculate correct health factor (Aave formula)", async function () {
      // Create test position: $10,000 collateral, $5,000 debt, 80% threshold
      // HF = (10000 * 0.8) / 5000 = 1.6
      const collateral = ethers.parseEther("10000");
      const debt = ethers.parseEther("5000");
      const threshold = ethers.parseEther("0.8"); // 80%

      // Set position (would normally be done through vault)
      // NOTE: This requires exposing a test function or using vault integration

      // Expected HF = 1.6
      const expectedHF = ethers.parseEther("1.6");

      // TODO: Implement test position setter
      // const actualHF = await liquidationEngine.calculateHealthFactor(borrower.address);
      // expect(actualHF).to.equal(expectedHF);
    });

    it("Should detect unhealthy position (HF < 1)", async function () {
      // Create unhealthy position: $10,000 collateral, $13,000 debt, 80% threshold
      // HF = (10000 * 0.8) / 13000 = 0.615 < 1.0

      // TODO: Implement test position setter
    });
  });

  describe("Close Factor Logic", function () {
    it("Should allow 50% liquidation when HF > 0.95", async function () {
      const healthFactor = ethers.parseEther("0.96"); // 0.96
      const closeFactor = await liquidationEngine.getCloseFactor(healthFactor);

      expect(closeFactor).to.equal(ethers.parseEther("0.5")); // 50%
    });

    it("Should allow 100% liquidation when HF < 0.95", async function () {
      const healthFactor = ethers.parseEther("0.94"); // 0.94
      const closeFactor = await liquidationEngine.getCloseFactor(healthFactor);

      expect(closeFactor).to.equal(ethers.parseEther("1")); // 100%
    });

    it("Should allow 100% liquidation when HF = 0.5", async function () {
      const healthFactor = ethers.parseEther("0.5");
      const closeFactor = await liquidationEngine.getCloseFactor(healthFactor);

      expect(closeFactor).to.equal(ethers.parseEther("1")); // 100%
    });
  });

  describe("Grace Period", function () {
    it("Should activate grace period for unhealthy position", async function () {
      // TODO: Set unhealthy position and activate grace period
      // await liquidationEngine.activateGracePeriod(borrower.address);

      // const position = await liquidationEngine.loanPositions(borrower.address);
      // expect(position.gracePeriodActive).to.be.true;
    });

    it("Should prevent liquidation during grace period", async function () {
      // TODO: Test grace period protection
    });

    it("Should allow liquidation after grace period expires", async function () {
      // TODO: Fast forward 24 hours and test liquidation
    });

    it("Should revert grace activation for healthy position", async function () {
      await expect(
        liquidationEngine.activateGracePeriod(borrower.address)
      ).to.be.revertedWithCustomError(liquidationEngine, "HealthFactorOk");
    });
  });

  describe("Liquidation Execution", function () {
    it("Should reject liquidation of healthy position", async function () {
      // TODO: Test healthy position rejection
    });

    it("Should calculate correct collateral seizure with bonus", async function () {
      // Debt to cover: $1000
      // Liquidation bonus: 7%
      // Collateral seized: $1000 * 1.07 = $1070

      // TODO: Test collateral calculation
    });

    it("Should enforce close factor limits", async function () {
      // TODO: Test partial vs full liquidation limits
    });

    it("Should improve health factor after liquidation", async function () {
      // TODO: Test HF improvement validation
    });

    it("Should emit LiquidationExecuted event", async function () {
      // TODO: Test event emission
    });

    it("Should record liquidation in history", async function () {
      // TODO: Test history tracking
    });
  });

  describe("Liquidation Bonus Management", function () {
    it("Should update liquidation bonus (owner)", async function () {
      const newBonus = ethers.parseEther("0.08"); // 8%

      await expect(liquidationEngine.setLiquidationBonus(newBonus))
        .to.emit(liquidationEngine, "LiquidationBonusUpdated")
        .withArgs(LIQUIDATION_BONUS, newBonus);

      expect(await liquidationEngine.liquidationBonus()).to.equal(newBonus);
    });

    it("Should reject invalid bonus update", async function () {
      await expect(
        liquidationEngine.setLiquidationBonus(ethers.parseEther("0.15")) // 15% too high
      ).to.be.revertedWithCustomError(liquidationEngine, "InvalidConfiguration");
    });

    it("Should reject non-owner bonus update", async function () {
      await expect(
        liquidationEngine.connect(borrower).setLiquidationBonus(
          ethers.parseEther("0.08")
        )
      ).to.be.revertedWithCustomError(liquidationEngine, "OwnableUnauthorizedAccount");
    });
  });

  describe("Asset Configuration", function () {
    it("Should configure asset-specific parameters", async function () {
      const wethAddress = "0x0000000000000000000000000000000000000001";
      const threshold = ethers.parseEther("0.8"); // 80%
      const bonus = ethers.parseEther("0.06"); // 6%

      await expect(
        liquidationEngine.configureAsset(wethAddress, threshold, bonus)
      )
        .to.emit(liquidationEngine, "AssetConfigured")
        .withArgs(wethAddress, threshold, bonus);

      expect(
        await liquidationEngine.assetLiquidationThresholds(wethAddress)
      ).to.equal(threshold);
      expect(
        await liquidationEngine.assetLiquidationBonuses(wethAddress)
      ).to.equal(bonus);
    });

    it("Should reject invalid asset bonus", async function () {
      const wethAddress = "0x0000000000000000000000000000000000000001";

      await expect(
        liquidationEngine.configureAsset(
          wethAddress,
          ethers.parseEther("0.8"),
          ethers.parseEther("0.15") // Too high
        )
      ).to.be.revertedWithCustomError(liquidationEngine, "InvalidConfiguration");
    });
  });

  describe("Emergency Controls", function () {
    it("Should pause liquidations (owner)", async function () {
      await liquidationEngine.pause();
      expect(await liquidationEngine.paused()).to.be.true;
    });

    it("Should unpause liquidations (owner)", async function () {
      await liquidationEngine.pause();
      await liquidationEngine.unpause();
      expect(await liquidationEngine.paused()).to.be.false;
    });

    it("Should reject liquidation when paused", async function () {
      await liquidationEngine.pause();

      // TODO: Test liquidation rejection when paused
    });
  });

  describe("Liquidation History", function () {
    it("Should return correct liquidation count", async function () {
      expect(await liquidationEngine.getLiquidationCount()).to.equal(0);

      // TODO: Execute liquidations and verify count
    });

    it("Should retrieve recent liquidations", async function () {
      // TODO: Execute multiple liquidations
      // const recent = await liquidationEngine.getRecentLiquidations(5);
      // expect(recent.length).to.equal(5);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple liquidations correctly", async function () {
      // TODO: Multi-liquidation scenario
    });

    it("Should handle partial liquidation followed by full", async function () {
      // TODO: Test partial → full liquidation flow
    });

    it("Should calculate liquidation profitability", async function () {
      // TODO: Test liquidator profit calculation
    });
  });
});
