import { ethers, upgrades } from "hardhat";

/**
 * @title UUPS Upgrade Script (Hardhat)
 * @notice Upgrades UUPS proxies to new implementations
 * @dev This script:
 *   1. Loads existing proxy addresses from deployment.json
 *   2. Deploys new implementation contracts
 *   3. Upgrades proxies to point to new implementations
 *   4. Validates upgrade success
 *
 * SAFETY CHECKS:
 * - OpenZeppelin defender plugin validates storage layout
 * - No storage variable reordering
 * - No storage variable deletion
 * - New variables must be appended only
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔄 Upgrading contracts with account:", deployer.address);

  // Load deployment addresses
  const fs = require('fs');
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync('./deployment.json', 'utf8'));
  } catch (error) {
    console.error("❌ Could not load deployment.json. Run deploy-upgradeable.ts first!");
    process.exit(1);
  }

  const {
    CreditRegistryProxy,
    ScoreOracleProxy,
    CreditVaultProxy
  } = deploymentInfo.contracts;

  console.log("\n📋 Loaded Proxy Addresses:");
  console.log("  CreditRegistry:", CreditRegistryProxy);
  console.log("  ScoreOracle:   ", ScoreOracleProxy);
  console.log("  CreditVault:   ", CreditVaultProxy);

  // ==================== Upgrade CreditRegistryV3 ====================
  console.log("\n🔄 Upgrading CreditRegistryV3Upgradeable...");
  const CreditRegistryV2 = await ethers.getContractFactory("CreditRegistryV3Upgradeable");

  try {
    const registryUpgraded = await upgrades.upgradeProxy(
      CreditRegistryProxy,
      CreditRegistryV2,
      {
        kind: "uups",
      }
    );
    await registryUpgraded.waitForDeployment();

    const newRegistryImpl = await upgrades.erc1967.getImplementationAddress(CreditRegistryProxy);
    console.log("✅ CreditRegistry upgraded successfully");
    console.log("   New implementation:", newRegistryImpl);

    // Verify version
    const version = await registryUpgraded.version();
    console.log("   Version:", version);
  } catch (error: any) {
    console.error("❌ CreditRegistry upgrade failed:", error.message);
  }

  // ==================== Upgrade ScoreOraclePhase3B ====================
  console.log("\n🔄 Upgrading ScoreOraclePhase3BUpgradeable...");
  const ScoreOracleV2 = await ethers.getContractFactory("ScoreOraclePhase3BUpgradeable");

  try {
    const oracleUpgraded = await upgrades.upgradeProxy(
      ScoreOracleProxy,
      ScoreOracleV2,
      {
        kind: "uups",
      }
    );
    await oracleUpgraded.waitForDeployment();

    const newOracleImpl = await upgrades.erc1967.getImplementationAddress(ScoreOracleProxy);
    console.log("✅ ScoreOracle upgraded successfully");
    console.log("   New implementation:", newOracleImpl);

    // Verify version
    const version = await oracleUpgraded.version();
    console.log("   Version:", version);
  } catch (error: any) {
    console.error("❌ ScoreOracle upgrade failed:", error.message);
  }

  // ==================== Upgrade CreditVaultV3 ====================
  console.log("\n🔄 Upgrading CreditVaultV3Upgradeable...");
  const CreditVaultV2 = await ethers.getContractFactory("CreditVaultV3Upgradeable");

  try {
    const vaultUpgraded = await upgrades.upgradeProxy(
      CreditVaultProxy,
      CreditVaultV2,
      {
        kind: "uups",
      }
    );
    await vaultUpgraded.waitForDeployment();

    const newVaultImpl = await upgrades.erc1967.getImplementationAddress(CreditVaultProxy);
    console.log("✅ CreditVault upgraded successfully");
    console.log("   New implementation:", newVaultImpl);

    // Verify version
    const version = await vaultUpgraded.version();
    console.log("   Version:", version);
  } catch (error: any) {
    console.error("❌ CreditVault upgrade failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 UPGRADE COMPLETE");
  console.log("=".repeat(60));

  console.log("\n⚠️  Important:");
  console.log("  1. Verify all data is preserved (check loan counts, scores, etc.)");
  console.log("  2. Test new functionality thoroughly");
  console.log("  3. Verify contracts on Arbiscan");
  console.log("  4. Update deployment.json with new implementation addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
