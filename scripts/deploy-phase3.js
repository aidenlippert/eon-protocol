const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Phase 3 Incremental Deployment Script
 * Deploys: CreditRegistryV2 → ScoreOraclePhase3 → CreditVaultV2
 * Network: Arbitrum Sepolia (testnet)
 */
async function main() {
  console.log("\n🚀 PHASE 3 INCREMENTAL DEPLOYMENT\n");
  console.log("=" .repeat(60));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  const deployments = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployed: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {}
  };

  // ==================== STEP 1: DEPLOY STAKING TOKEN (FOR TESTNET) ====================

  console.log("📦 Step 1: Deploy Staking Token (Mock for testnet)");

  // For mainnet, use existing governance token
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const stakingToken = await MockERC20.deploy("Eon Staking Token", "EON", 18);
  await stakingToken.waitForDeployment();

  const stakingTokenAddress = await stakingToken.getAddress();
  deployments.contracts.StakingToken = stakingTokenAddress;

  console.log("✅ Staking Token deployed:", stakingTokenAddress);
  console.log("");

  // ==================== STEP 2: DEPLOY CREDIT REGISTRY V2 ====================

  console.log("📦 Step 2: Deploy CreditRegistryV2");

  const CreditRegistryV2 = await hre.ethers.getContractFactory("CreditRegistryV2");
  const registry = await CreditRegistryV2.deploy(stakingTokenAddress);
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  deployments.contracts.CreditRegistryV2 = registryAddress;

  console.log("✅ CreditRegistryV2 deployed:", registryAddress);
  console.log("");

  // ==================== STEP 3: DEPLOY SCORE ORACLE PHASE 3 ====================

  console.log("📦 Step 3: Deploy ScoreOraclePhase3");

  const ScoreOraclePhase3 = await hre.ethers.getContractFactory("ScoreOraclePhase3");
  const oracle = await ScoreOraclePhase3.deploy(registryAddress);
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  deployments.contracts.ScoreOraclePhase3 = oracleAddress;

  console.log("✅ ScoreOraclePhase3 deployed:", oracleAddress);
  console.log("");

  // ==================== STEP 4: DEPLOY CREDIT VAULT V2 ====================

  console.log("📦 Step 4: Deploy CreditVaultV2");

  const CreditVaultV2 = await hre.ethers.getContractFactory("CreditVaultV2");
  const vault = await CreditVaultV2.deploy(registryAddress, oracleAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  deployments.contracts.CreditVaultV2 = vaultAddress;

  console.log("✅ CreditVaultV2 deployed:", vaultAddress);
  console.log("");

  // ==================== STEP 5: DEPLOY MOCK ASSETS (TESTNET ONLY) ====================

  console.log("📦 Step 5: Deploy Mock Assets (Testnet)");

  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  const weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();

  deployments.contracts.MockUSDC = usdcAddress;
  deployments.contracts.MockWETH = wethAddress;

  console.log("✅ Mock USDC deployed:", usdcAddress);
  console.log("✅ Mock WETH deployed:", wethAddress);
  console.log("");

  // ==================== STEP 6: DEPLOY MOCK PRICE FEEDS ====================

  console.log("📦 Step 6: Deploy Mock Price Feeds");

  const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");

  const usdcFeed = await MockV3Aggregator.deploy(8, 1_00000000); // $1.00
  await usdcFeed.waitForDeployment();
  const usdcFeedAddress = await usdcFeed.getAddress();

  const wethFeed = await MockV3Aggregator.deploy(8, 2000_00000000); // $2000.00
  await wethFeed.waitForDeployment();
  const wethFeedAddress = await wethFeed.getAddress();

  deployments.priceFeeds = {
    USDC: usdcFeedAddress,
    WETH: wethFeedAddress
  };

  console.log("✅ USDC Price Feed deployed:", usdcFeedAddress);
  console.log("✅ WETH Price Feed deployed:", wethFeedAddress);
  console.log("");

  // ==================== STEP 7: CONFIGURE SYSTEM ====================

  console.log("⚙️  Step 7: Configure System");

  // Authorize vault as lender
  const tx1 = await registry.setAuthorizedLender(vaultAddress, true);
  await tx1.wait();
  console.log("✅ Vault authorized as lender in registry");

  // Configure assets in vault
  const tx2 = await vault.setAsset(usdcAddress, usdcFeedAddress, true);
  await tx2.wait();
  console.log("✅ USDC configured in vault");

  const tx3 = await vault.setAsset(wethAddress, wethFeedAddress, true);
  await tx3.wait();
  console.log("✅ WETH configured in vault");

  // Set insurance pool (deployer as placeholder)
  const tx4 = await vault.setInsurancePool(deployer.address);
  await tx4.wait();
  console.log("✅ Insurance pool set (deployer as placeholder)");

  console.log("");

  // ==================== STEP 8: VERIFY CONFIGURATION ====================

  console.log("🔍 Step 8: Verify Configuration");

  const isAuthorized = await registry.authorizedLenders(vaultAddress);
  const usdcConfig = await vault.assets(usdcAddress);
  const wethConfig = await vault.assets(wethAddress);
  const insurancePool = await vault.insurancePool();

  console.log("  Vault authorized:", isAuthorized ? "✓" : "✗");
  console.log("  USDC allowed:", usdcConfig.allowed ? "✓" : "✗");
  console.log("  WETH allowed:", wethConfig.allowed ? "✓" : "✗");
  console.log("  Insurance pool:", insurancePool === deployer.address ? "✓" : "✗");
  console.log("");

  // ==================== DEPLOYMENT SUMMARY ====================

  console.log("=" .repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\n📦 Core Contracts:");
  console.log("  CreditRegistryV2:   ", registryAddress);
  console.log("  ScoreOraclePhase3:  ", oracleAddress);
  console.log("  CreditVaultV2:      ", vaultAddress);

  console.log("\n🪙 Test Assets:");
  console.log("  Mock USDC:          ", usdcAddress);
  console.log("  Mock WETH:          ", wethAddress);
  console.log("  Staking Token:      ", stakingTokenAddress);

  console.log("\n📊 Price Feeds:");
  console.log("  USDC Feed:          ", usdcFeedAddress);
  console.log("  WETH Feed:          ", wethFeedAddress);

  console.log("\n⚙️  Configuration:");
  console.log("  Vault Authorized:   ", isAuthorized);
  console.log("  Insurance Pool:     ", insurancePool);

  console.log("\n📝 Next Steps:");
  console.log("  1. Verify contracts on Arbiscan:");
  console.log(`     npx hardhat verify --network ${hre.network.name} ${registryAddress} ${stakingTokenAddress}`);
  console.log(`     npx hardhat verify --network ${hre.network.name} ${oracleAddress} ${registryAddress}`);
  console.log(`     npx hardhat verify --network ${hre.network.name} ${vaultAddress} ${registryAddress} ${oracleAddress}`);

  console.log("\n  2. Run integration tests:");
  console.log("     npx hardhat test test/phase3_integration.test.js");

  console.log("\n  3. Update frontend addresses:");
  console.log("     frontend/lib/contracts/addresses.ts");

  console.log("\n  4. Test feedback loop:");
  console.log("     npx hardhat test test/phase3_feedback.test.js");

  console.log("\n" + "=".repeat(60));

  // ==================== SAVE DEPLOYMENT DATA ====================

  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `phase3-${hre.network.name}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deployments, null, 2));
  console.log(`\n📄 Deployment data saved to: deployments/${filename}\n`);

  // ==================== GENERATE FRONTEND CONFIG ====================

  const frontendConfig = {
    chainId: deployments.chainId,
    contracts: {
      CreditRegistryV2: registryAddress,
      ScoreOraclePhase3: oracleAddress,
      CreditVaultV2: vaultAddress,
      USDC: usdcAddress,
      WETH: wethAddress,
      StakingToken: stakingTokenAddress
    },
    priceFeeds: deployments.priceFeeds
  };

  const frontendPath = path.join(__dirname, '../frontend-config.json');
  fs.writeFileSync(frontendPath, JSON.stringify(frontendConfig, null, 2));
  console.log(`📱 Frontend config saved to: frontend-config.json\n`);

  console.log("✅ Phase 3 deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
