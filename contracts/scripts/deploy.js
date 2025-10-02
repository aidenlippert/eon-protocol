const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * EON PROTOCOL DEPLOYMENT SCRIPT
 *
 * Deploys all 6 contracts to Arbitrum Sepolia
 * Saves addresses to deployments.json
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network arbitrumSepolia
 */

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("\n🚀 EON PROTOCOL DEPLOYMENT");
  console.log("=" .repeat(50));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  const deployments = {};

  // 1. Deploy ZK Verifier Mock (for testnet)
  console.log("📝 Deploying ZKVerifierMock...");
  const ZKVerifierMock = await hre.ethers.getContractFactory("ZKVerifierMock");
  const zkVerifier = await ZKVerifierMock.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  deployments.zkVerifier = zkVerifierAddress;
  console.log(`✅ ZKVerifierMock deployed: ${zkVerifierAddress}\n`);

  // 2. Deploy ChronosNFT
  console.log("📝 Deploying ChronosNFT...");
  const ChronosNFT = await hre.ethers.getContractFactory("ChronosNFT");
  const chronosNFT = await ChronosNFT.deploy();
  await chronosNFT.waitForDeployment();
  const chronosNFTAddress = await chronosNFT.getAddress();
  deployments.chronosNFT = chronosNFTAddress;
  console.log(`✅ ChronosNFT deployed: ${chronosNFTAddress}\n`);

  // 3. Deploy ChronosCore
  console.log("📝 Deploying ChronosCore...");
  const ChronosCore = await hre.ethers.getContractFactory("ChronosCore");
  const chronosCore = await ChronosCore.deploy();
  await chronosCore.waitForDeployment();
  const chronosCoreAddress = await chronosCore.getAddress();
  deployments.chronosCore = chronosCoreAddress;
  console.log(`✅ ChronosCore deployed: ${chronosCoreAddress}\n`);

  // 4. Deploy ClaimManager
  console.log("📝 Deploying ClaimManager...");
  const ClaimManager = await hre.ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(zkVerifierAddress, chronosNFTAddress);
  await claimManager.waitForDeployment();
  const claimManagerAddress = await claimManager.getAddress();
  deployments.claimManager = claimManagerAddress;
  console.log(`✅ ClaimManager deployed: ${claimManagerAddress}\n`);

  // 5. Deploy LendingPool
  console.log("📝 Deploying LendingPool...");
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(chronosNFTAddress, claimManagerAddress);
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  deployments.lendingPool = lendingPoolAddress;
  console.log(`✅ LendingPool deployed: ${lendingPoolAddress}\n`);

  // 6. Deploy ReputationOracle (cross-chain)
  console.log("📝 Deploying ReputationOracle...");
  const ReputationOracle = await hre.ethers.getContractFactory("ReputationOracle");
  const reputationOracle = await ReputationOracle.deploy(chronosNFTAddress);
  await reputationOracle.waitForDeployment();
  const reputationOracleAddress = await reputationOracle.getAddress();
  deployments.reputationOracle = reputationOracleAddress;
  console.log(`✅ ReputationOracle deployed: ${reputationOracleAddress}\n`);

  // Grant minter role to ClaimManager
  console.log("🔧 Granting minter role to ClaimManager...");
  const MINTER_ROLE = await chronosNFT.MINTER_ROLE();
  await chronosNFT.grantRole(MINTER_ROLE, claimManagerAddress);
  console.log("✅ Minter role granted\n");

  // Initialize lending pools
  console.log("🔧 Initializing lending pools...");

  // Conservative pool: 50-70% LTV, 5% APR
  await lendingPool.createPool(
    0, // PoolType.Conservative
    500,  // minLTV (50%)
    700,  // maxLTV (70%)
    500,  // minAPR (5%)
    1000  // maxAPR (10%)
  );

  // Balanced pool: 60-80% LTV, 7% APR
  await lendingPool.createPool(
    1, // PoolType.Balanced
    600,  // minLTV (60%)
    800,  // maxLTV (80%)
    700,  // minAPR (7%)
    1200  // maxAPR (12%)
  );

  // Aggressive pool: 70-90% LTV, 10% APR
  await lendingPool.createPool(
    2, // PoolType.Aggressive
    700,  // minLTV (70%)
    900,  // maxLTV (90%)
    1000, // minAPR (10%)
    1500  // maxAPR (15%)
  );

  console.log("✅ Pools initialized\n");

  // Save deployments to JSON
  const deploymentsPath = path.join(__dirname, `../deployments-${network}.json`);
  const deploymentData = {
    network,
    chainId: network === 'arbitrumSepolia' ? 421614 : 42161,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployments
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2));
  console.log(`📁 Deployment addresses saved to: ${deploymentsPath}\n`);

  // Print summary
  console.log("=" .repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE\n");
  console.log("Contract Addresses:");
  console.log(`  ZKVerifier:       ${zkVerifierAddress}`);
  console.log(`  ChronosNFT:       ${chronosNFTAddress}`);
  console.log(`  ChronosCore:      ${chronosCoreAddress}`);
  console.log(`  ClaimManager:     ${claimManagerAddress}`);
  console.log(`  LendingPool:      ${lendingPoolAddress}`);
  console.log(`  ReputationOracle: ${reputationOracleAddress}\n`);

  console.log("Next Steps:");
  console.log("  1. Verify contracts: npx hardhat verify --network arbitrumSepolia <address>");
  console.log(`  2. Update indexer .env with ClaimManager address: ${claimManagerAddress}`);
  console.log(`  3. Update frontend with contract addresses`);
  console.log("  4. Get testnet ETH from https://faucet.quicknode.com/arbitrum/sepolia\n");

  console.log("=" .repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
