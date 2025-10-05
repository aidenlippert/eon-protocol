import { ethers } from "hardhat";
import { upgrades } from "hardhat";

/**
 * @title UUPS Deployment Script (Hardhat)
 * @notice Deploys upgradeable contracts using OpenZeppelin UUPS pattern
 * @dev This script:
 *   1. Deploys ChainlinkPriceOracle (non-upgradeable)
 *   2. Deploys CreditRegistryV3Upgradeable via UUPS proxy
 *   3. Deploys ScoreOraclePhase3BUpgradeable via UUPS proxy
 *   4. Deploys CreditVaultV3Upgradeable via UUPS proxy
 *   5. Configures access control and dependencies
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with account:", deployer.address);
  console.log("📊 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // ==================== 1. Deploy ChainlinkPriceOracle (Non-Upgradeable) ====================
  console.log("\n📦 Deploying ChainlinkPriceOracle...");
  const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
  const priceOracle = await ChainlinkPriceOracle.deploy();
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("✅ ChainlinkPriceOracle deployed at:", priceOracleAddress);

  // ==================== 2. Deploy CreditRegistryV3Upgradeable (UUPS Proxy) ====================
  console.log("\n📦 Deploying CreditRegistryV3Upgradeable...");
  const CreditRegistry = await ethers.getContractFactory("CreditRegistryV3Upgradeable");

  const stakeToken = ethers.ZeroAddress; // TODO: Replace with actual stake token
  const registry = await upgrades.deployProxy(
    CreditRegistry,
    [deployer.address, stakeToken],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ CreditRegistryV3Upgradeable (Proxy) deployed at:", registryAddress);

  const registryImpl = await upgrades.erc1967.getImplementationAddress(registryAddress);
  console.log("   Implementation address:", registryImpl);

  // ==================== 3. Deploy ScoreOraclePhase3BUpgradeable (UUPS Proxy) ====================
  console.log("\n📦 Deploying ScoreOraclePhase3BUpgradeable...");
  const ScoreOracle = await ethers.getContractFactory("ScoreOraclePhase3BUpgradeable");

  const oracle = await upgrades.deployProxy(
    ScoreOracle,
    [deployer.address, registryAddress],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ ScoreOraclePhase3BUpgradeable (Proxy) deployed at:", oracleAddress);

  const oracleImpl = await upgrades.erc1967.getImplementationAddress(oracleAddress);
  console.log("   Implementation address:", oracleImpl);

  // ==================== 4. Deploy CreditVaultV3Upgradeable (UUPS Proxy) ====================
  console.log("\n📦 Deploying CreditVaultV3Upgradeable...");
  const CreditVault = await ethers.getContractFactory("CreditVaultV3Upgradeable");

  const vault = await upgrades.deployProxy(
    CreditVault,
    [deployer.address, registryAddress, oracleAddress, priceOracleAddress],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ CreditVaultV3Upgradeable (Proxy) deployed at:", vaultAddress);

  const vaultImpl = await upgrades.erc1967.getImplementationAddress(vaultAddress);
  console.log("   Implementation address:", vaultImpl);

  // ==================== 5. Configure Access Control ====================
  console.log("\n🔐 Configuring access control...");

  // Authorize vault as lender in registry
  const tx1 = await registry.setLenderAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("✅ Vault authorized as lender in Registry");

  // ==================== 6. Summary ====================
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("  ChainlinkPriceOracle:      ", priceOracleAddress);
  console.log("  CreditRegistry (Proxy):    ", registryAddress);
  console.log("  CreditRegistry (Impl):     ", registryImpl);
  console.log("  ScoreOracle (Proxy):       ", oracleAddress);
  console.log("  ScoreOracle (Impl):        ", oracleImpl);
  console.log("  CreditVault (Proxy):       ", vaultAddress);
  console.log("  CreditVault (Impl):        ", vaultImpl);

  console.log("\n⚙️  Next Steps:");
  console.log("  1. Configure price feeds in ChainlinkPriceOracle");
  console.log("  2. Set allowed assets in CreditVault");
  console.log("  3. Set insurance pool address (optional)");
  console.log("  4. Verify contracts on Arbiscan");
  console.log("  5. Test upgrade flow with upgrade script");

  console.log("\n💾 Save these addresses for upgrade scripts!");

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ChainlinkPriceOracle: priceOracleAddress,
      CreditRegistryProxy: registryAddress,
      CreditRegistryImpl: registryImpl,
      ScoreOracleProxy: oracleAddress,
      ScoreOracleImpl: oracleImpl,
      CreditVaultProxy: vaultAddress,
      CreditVaultImpl: vaultImpl,
    }
  };

  console.log("\n📄 Deployment info saved to deployment.json");
  const fs = require('fs');
  fs.writeFileSync(
    './deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
