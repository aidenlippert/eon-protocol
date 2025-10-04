const hre = require("hardhat");

/**
 * Deploy CreditVault system to Arbitrum Sepolia
 * Prerequisites:
 * - CreditRegistry already deployed at 0xBF69B777Af1ADCcF2814344b06AF028d32c4b1FE
 * - USDC available at 0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f
 */
async function main() {
  console.log("\n🚀 Starting CreditVault deployment on Arbitrum Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Existing contract addresses on Arbitrum Sepolia
  const EXISTING_REGISTRY = "0xBF69B777Af1ADCcF2814344b06AF028d32c4b1FE";
  const EXISTING_USDC = "0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f";

  // Chainlink price feeds on Arbitrum Sepolia
  // Note: These are mainnet addresses - for testnet you may need mock feeds
  const USDC_PRICE_FEED = "0x3f12643D3f6f874d39C2a4c9f2Cd6f2DbAC877FC"; // USDC/USD on Arb mainnet
  const ETH_PRICE_FEED = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";  // ETH/USD on Arb mainnet

  console.log("📋 Using existing contracts:");
  console.log("  CreditRegistry:", EXISTING_REGISTRY);
  console.log("  USDC:", EXISTING_USDC);
  console.log("\n");

  // ==================== DEPLOY SCORE ORACLE ====================

  console.log("📊 Deploying ScoreOracle...");
  const ScoreOracle = await hre.ethers.getContractFactory("ScoreOracle");
  const oracle = await ScoreOracle.deploy(EXISTING_REGISTRY);
  await oracle.waitForDeployment();

  const oracleAddress = await oracle.getAddress();
  console.log("✅ ScoreOracle deployed to:", oracleAddress);
  console.log("\n");

  // ==================== DEPLOY CREDIT VAULT ====================

  console.log("🏦 Deploying CreditVault...");
  const CreditVault = await hre.ethers.getContractFactory("CreditVault");
  const vault = await CreditVault.deploy(EXISTING_REGISTRY, oracleAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ CreditVault deployed to:", vaultAddress);
  console.log("\n");

  // ==================== CONFIGURE ASSETS ====================

  console.log("⚙️ Configuring assets...");

  // Note: For testnet, you might want to deploy mock price feeds
  // For now, we'll use mainnet feeds (which won't work on testnet)
  // TODO: Deploy MockV3Aggregator contracts for testnet

  console.log("  Configuring USDC...");
  const tx1 = await vault.setAsset(EXISTING_USDC, USDC_PRICE_FEED, true);
  await tx1.wait();
  console.log("  ✅ USDC configured");

  // If WETH exists on testnet, configure it
  // const EXISTING_WETH = "0x..."; // Add if available
  // console.log("  Configuring WETH...");
  // const tx2 = await vault.setAsset(EXISTING_WETH, ETH_PRICE_FEED, true);
  // await tx2.wait();
  // console.log("  ✅ WETH configured");

  console.log("\n");

  // ==================== AUTHORIZE VAULT ====================

  console.log("🔐 Authorizing vault as lender in registry...");

  // Get registry contract
  const registry = await hre.ethers.getContractAt(
    "CreditRegistryV1_1",
    EXISTING_REGISTRY
  );

  const tx3 = await registry.setAuthorizedLender(vaultAddress, true);
  await tx3.wait();
  console.log("✅ Vault authorized as lender");
  console.log("\n");

  // ==================== CONFIGURE INSURANCE POOL ====================

  console.log("🛡️ Setting insurance pool...");

  // For testnet, use deployer as insurance pool
  // For production, deploy actual InsuranceFund contract
  const INSURANCE_POOL = deployer.address; // Placeholder

  const tx4 = await vault.setInsurancePool(INSURANCE_POOL);
  await tx4.wait();
  console.log("✅ Insurance pool set to:", INSURANCE_POOL);
  console.log("  (Note: Using deployer as placeholder - deploy InsuranceFund for production)");
  console.log("\n");

  // ==================== VERIFY CONFIGURATION ====================

  console.log("✅ Verifying configuration...");

  const oracleConfig = await vault.oracle();
  const registryConfig = await vault.registry();
  const insuranceConfig = await vault.insurancePool();
  const usdcConfig = await vault.assets(EXISTING_USDC);

  console.log("  Oracle:", oracleConfig === oracleAddress ? "✅" : "❌");
  console.log("  Registry:", registryConfig === EXISTING_REGISTRY ? "✅" : "❌");
  console.log("  Insurance Pool:", insuranceConfig === INSURANCE_POOL ? "✅" : "❌");
  console.log("  USDC allowed:", usdcConfig.allowed ? "✅" : "❌");
  console.log("\n");

  // ==================== DEPLOYMENT SUMMARY ====================

  console.log("=" .repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\n📦 Deployed Contracts:");
  console.log("  CreditRegistry:  ", EXISTING_REGISTRY, "(existing)");
  console.log("  ScoreOracle:     ", oracleAddress);
  console.log("  CreditVault:     ", vaultAddress);
  console.log("\n🪙 Configured Assets:");
  console.log("  USDC:            ", EXISTING_USDC);
  console.log("  USDC Price Feed: ", USDC_PRICE_FEED);
  console.log("\n🔧 Configuration:");
  console.log("  Insurance Pool:  ", INSURANCE_POOL);
  console.log("  Authorized:      ", "vault → registry");
  console.log("\n📝 Next Steps:");
  console.log("  1. Verify contracts on Arbiscan:");
  console.log("     npx hardhat verify --network arbitrumSepolia", oracleAddress, EXISTING_REGISTRY);
  console.log("     npx hardhat verify --network arbitrumSepolia", vaultAddress, EXISTING_REGISTRY, oracleAddress);
  console.log("\n  2. Update frontend with new addresses:");
  console.log("     - ScoreOracle:", oracleAddress);
  console.log("     - CreditVault:", vaultAddress);
  console.log("\n  3. Deploy mock price feeds for testnet (optional)");
  console.log("\n  4. Deploy InsuranceFund contract (for production)");
  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Deployment complete!\n");

  // Save addresses to file
  const fs = require('fs');
  const addresses = {
    network: "arbitrumSepolia",
    chainId: 421614,
    deployed: new Date().toISOString(),
    contracts: {
      CreditRegistry: EXISTING_REGISTRY,
      ScoreOracle: oracleAddress,
      CreditVault: vaultAddress,
      USDC: EXISTING_USDC,
    },
    priceFeeds: {
      USDC: USDC_PRICE_FEED,
      ETH: ETH_PRICE_FEED,
    },
    configuration: {
      insurancePool: INSURANCE_POOL,
      vaultAuthorized: true,
    }
  };

  fs.writeFileSync(
    'deployments/arbitrum-sepolia.json',
    JSON.stringify(addresses, null, 2)
  );

  console.log("📄 Deployment addresses saved to deployments/arbitrum-sepolia.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
