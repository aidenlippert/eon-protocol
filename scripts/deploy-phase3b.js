const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 PHASE 3B DEPLOYMENT - Complete 5-Factor Credit Scoring\n");
  console.log("============================================================");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ==================== DEPLOY CORE CONTRACTS ====================

  console.log("📦 Step 1: Deploy Staking Token (Mock for testnet)");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const stakingToken = await MockERC20.deploy("Eon Staking Token", "EON", 18);
  await stakingToken.waitForDeployment();
  console.log("✅ Staking Token deployed:", await stakingToken.getAddress());

  // KYC Issuer Address (Didit issuer - update with real address)
  // For now, use deployer as placeholder
  const kycIssuer = process.env.KYC_ISSUER_ADDRESS || deployer.address;
  console.log("🔐 KYC Issuer Address:", kycIssuer);

  console.log("\n📦 Step 2: Deploy CreditRegistryV3");
  const CreditRegistryV3 = await hre.ethers.getContractFactory("CreditRegistryV3");
  const registry = await CreditRegistryV3.deploy(
    await stakingToken.getAddress(),
    kycIssuer
  );
  await registry.waitForDeployment();
  console.log("✅ CreditRegistryV3 deployed:", await registry.getAddress());

  console.log("\n📦 Step 3: Deploy ScoreOraclePhase3B");
  const ScoreOraclePhase3B = await hre.ethers.getContractFactory("ScoreOraclePhase3B");
  const oracle = await ScoreOraclePhase3B.deploy(await registry.getAddress());
  await oracle.waitForDeployment();
  console.log("✅ ScoreOraclePhase3B deployed:", await oracle.getAddress());

  console.log("\n📦 Step 4: Deploy CreditVaultV3");
  const CreditVaultV3 = await hre.ethers.getContractFactory("CreditVaultV3");
  const vault = await CreditVaultV3.deploy(
    await registry.getAddress(),
    await oracle.getAddress()
  );
  await vault.waitForDeployment();
  console.log("✅ CreditVaultV3 deployed:", await vault.getAddress());

  // ==================== DEPLOY MOCK ASSETS ====================

  console.log("\n📦 Step 5: Deploy Mock Assets (Testnet)");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
  await mockUSDC.waitForDeployment();
  console.log("✅ Mock USDC deployed:", await mockUSDC.getAddress());

  const mockWETH = await MockERC20.deploy("Mock WETH", "WETH", 18);
  await mockWETH.waitForDeployment();
  console.log("✅ Mock WETH deployed:", await mockWETH.getAddress());

  // ==================== DEPLOY MOCK PRICE FEEDS ====================

  console.log("\n📦 Step 6: Deploy Mock Price Feeds");
  const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");

  // USDC price feed: $1.00 with 8 decimals
  const usdcFeed = await MockV3Aggregator.deploy(8, 100000000);
  await usdcFeed.waitForDeployment();
  console.log("✅ USDC Price Feed deployed:", await usdcFeed.getAddress());

  // WETH price feed: $2000 with 8 decimals
  const wethFeed = await MockV3Aggregator.deploy(8, 200000000000);
  await wethFeed.waitForDeployment();
  console.log("✅ WETH Price Feed deployed:", await wethFeed.getAddress());

  // ==================== CONFIGURE SYSTEM ====================

  console.log("\n⚙️  Step 7: Configure System");

  // Authorize vault as lender in registry
  await registry.setAuthorizedLender(await vault.getAddress(), true);
  console.log("✅ Vault authorized as lender in registry");

  // Configure assets in vault
  await vault.setAsset(await mockUSDC.getAddress(), await usdcFeed.getAddress(), true);
  console.log("✅ USDC configured in vault");

  await vault.setAsset(await mockWETH.getAddress(), await wethFeed.getAddress(), true);
  console.log("✅ WETH configured in vault");

  // Set insurance pool (use deployer as placeholder)
  await vault.setInsurancePool(deployer.address);
  console.log("✅ Insurance pool set (deployer as placeholder)");

  // ==================== VERIFY CONFIGURATION ====================

  console.log("\n🔍 Step 8: Verify Configuration");
  const isVaultAuthorized = await registry.authorizedLenders(await vault.getAddress());
  const usdcAsset = await vault.assets(await mockUSDC.getAddress());
  const wethAsset = await vault.assets(await mockWETH.getAddress());
  const insurancePool = await vault.insurancePool();

  console.log("  Vault authorized:", isVaultAuthorized ? "✓" : "✗");
  console.log("  USDC allowed:", usdcAsset.allowed ? "✓" : "✗");
  console.log("  WETH allowed:", wethAsset.allowed ? "✓" : "✗");
  console.log("  Insurance pool:", insurancePool ? "✓" : "✗");

  // ==================== SAVE DEPLOYMENT DATA ====================

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();

  const deploymentData = {
    network: network,
    chainId: chainId,
    deployed: new Date().toISOString(),
    deployer: deployer.address,
    kycIssuer: kycIssuer,
    contracts: {
      StakingToken: await stakingToken.getAddress(),
      CreditRegistryV3: await registry.getAddress(),
      ScoreOraclePhase3B: await oracle.getAddress(),
      CreditVaultV3: await vault.getAddress(),
      MockUSDC: await mockUSDC.getAddress(),
      MockWETH: await mockWETH.getAddress(),
    },
    priceFeeds: {
      USDC: await usdcFeed.getAddress(),
      WETH: await wethFeed.getAddress(),
    },
  };

  // Save deployment data
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `phase3b-${network}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  // Save frontend config
  const frontendConfig = {
    chainId: chainId,
    contracts: {
      CreditRegistryV3: await registry.getAddress(),
      ScoreOraclePhase3B: await oracle.getAddress(),
      CreditVaultV3: await vault.getAddress(),
      USDC: await mockUSDC.getAddress(),
      WETH: await mockWETH.getAddress(),
      StakingToken: await stakingToken.getAddress(),
    },
    priceFeeds: {
      USDC: await usdcFeed.getAddress(),
      WETH: await wethFeed.getAddress(),
    },
    kycIssuer: kycIssuer,
  };

  const frontendConfigFile = path.join(__dirname, "..", "frontend-config-phase3b.json");
  fs.writeFileSync(frontendConfigFile, JSON.stringify(frontendConfig, null, 2));

  // ==================== DEPLOYMENT SUMMARY ====================

  console.log("\n============================================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("============================================================\n");

  console.log("📦 Core Contracts:");
  console.log("  CreditRegistryV3:    ", await registry.getAddress());
  console.log("  ScoreOraclePhase3B:  ", await oracle.getAddress());
  console.log("  CreditVaultV3:       ", await vault.getAddress());

  console.log("\n🪙 Test Assets:");
  console.log("  Mock USDC:           ", await mockUSDC.getAddress());
  console.log("  Mock WETH:           ", await mockWETH.getAddress());
  console.log("  Staking Token:       ", await stakingToken.getAddress());

  console.log("\n📊 Price Feeds:");
  console.log("  USDC Feed:           ", await usdcFeed.getAddress());
  console.log("  WETH Feed:           ", await wethFeed.getAddress());

  console.log("\n⚙️  Configuration:");
  console.log("  Vault Authorized:    ", isVaultAuthorized);
  console.log("  Insurance Pool:      ", insurancePool);
  console.log("  KYC Issuer:          ", kycIssuer);

  console.log("\n📝 Next Steps:");
  console.log("  1. Verify contracts on Arbiscan:");
  console.log(`     npx hardhat verify --network ${network} ${await registry.getAddress()} ${await stakingToken.getAddress()} ${kycIssuer}`);
  console.log(`     npx hardhat verify --network ${network} ${await oracle.getAddress()} ${await registry.getAddress()}`);
  console.log(`     npx hardhat verify --network ${network} ${await vault.getAddress()} ${await registry.getAddress()} ${await oracle.getAddress()}`);

  console.log("\n  2. Update frontend addresses:");
  console.log("     frontend/lib/contracts/addresses.ts");

  console.log("\n  3. Configure Didit KYC:");
  console.log("     - Update KYC_ISSUER_ADDRESS in .env");
  console.log("     - Update kycIssuer via: registry.setKYCIssuer(newAddress)");

  console.log("\n  4. Test complete flow:");
  console.log("     - Submit KYC proof");
  console.log("     - Verify score increases");
  console.log("     - Test borrow with improved LTV");

  console.log("\n============================================================\n");

  console.log("📄 Deployment data saved to:", deploymentFile);
  console.log("📱 Frontend config saved to:", frontendConfigFile);

  console.log("\n✅ Phase 3B deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
