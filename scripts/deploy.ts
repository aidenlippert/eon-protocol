import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Eon Protocol Phase 1 to Arbitrum Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from address:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  WARNING: Low balance! Get testnet ETH from https://faucet.quicknode.com/arbitrum/sepolia\n");
  }

  // ===== STEP 1: Deploy Mock Stablecoin (for testnet) =====
  console.log("1️⃣  Deploying MockERC20 (USDC)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const stablecoin = await MockERC20.deploy("USD Coin", "USDC");
  await stablecoin.waitForDeployment();
  const stablecoinAddress = await stablecoin.getAddress();
  console.log("✅ Mock USDC deployed to:", stablecoinAddress, "\n");

  // ===== STEP 2: Deploy MockLendingPool =====
  console.log("2️⃣  Deploying MockLendingPool...");
  const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
  const lendingPool = await MockLendingPool.deploy();
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log("✅ MockLendingPool deployed to:", lendingPoolAddress, "\n");

  // ===== STEP 3: Deploy ReputationScorer =====
  console.log("3️⃣  Deploying ReputationScorer...");
  const ReputationScorer = await ethers.getContractFactory("ReputationScorer");
  const reputationScorer = await ReputationScorer.deploy();
  await reputationScorer.waitForDeployment();
  const reputationScorerAddress = await reputationScorer.getAddress();
  console.log("✅ ReputationScorer deployed to:", reputationScorerAddress, "\n");

  // ===== STEP 4: Deploy DutchAuctionLiquidator =====
  console.log("4️⃣  Deploying DutchAuctionLiquidator...");
  const DutchAuctionLiquidator = await ethers.getContractFactory("DutchAuctionLiquidator");
  const liquidator = await DutchAuctionLiquidator.deploy(
    reputationScorerAddress,
    lendingPoolAddress
  );
  await liquidator.waitForDeployment();
  const liquidatorAddress = await liquidator.getAddress();
  console.log("✅ DutchAuctionLiquidator deployed to:", liquidatorAddress, "\n");

  // ===== STEP 5: Deploy HealthFactorMonitor =====
  console.log("5️⃣  Deploying HealthFactorMonitor...");
  const MOCK_ORACLE = deployer.address; // Use deployer as mock oracle for testnet
  const HealthFactorMonitor = await ethers.getContractFactory("HealthFactorMonitor");
  const healthMonitor = await HealthFactorMonitor.deploy(
    reputationScorerAddress,
    lendingPoolAddress,
    MOCK_ORACLE
  );
  await healthMonitor.waitForDeployment();
  const healthMonitorAddress = await healthMonitor.getAddress();
  console.log("✅ HealthFactorMonitor deployed to:", healthMonitorAddress, "\n");

  // ===== STEP 6: Deploy InsuranceFund =====
  console.log("6️⃣  Deploying InsuranceFund...");
  const InsuranceFund = await ethers.getContractFactory("InsuranceFund");
  const insuranceFund = await InsuranceFund.deploy(stablecoinAddress);
  await insuranceFund.waitForDeployment();
  const insuranceFundAddress = await insuranceFund.getAddress();
  console.log("✅ InsuranceFund deployed to:", insuranceFundAddress, "\n");

  // ===== STEP 7: Setup Authorizations =====
  console.log("7️⃣  Setting up contract authorizations...");

  // Authorize LendingPool to update reputation scores
  await reputationScorer.setAuthorizedUpdater(lendingPoolAddress, true);
  console.log("   ✓ LendingPool authorized in ReputationScorer");

  // Authorize Liquidator to update reputation scores
  await reputationScorer.setAuthorizedUpdater(liquidatorAddress, true);
  console.log("   ✓ Liquidator authorized in ReputationScorer");

  // Authorize HealthMonitor to update reputation scores
  await reputationScorer.setAuthorizedUpdater(healthMonitorAddress, true);
  console.log("   ✓ HealthMonitor authorized in ReputationScorer");

  // Authorize LendingPool to request insurance coverage
  await insuranceFund.setAuthorizedRequestor(lendingPoolAddress, true);
  console.log("   ✓ LendingPool authorized in InsuranceFund");

  console.log("\n");

  // ===== DEPLOYMENT SUMMARY =====
  console.log("=" .repeat(70));
  console.log("🎉 PHASE 1 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(70));
  console.log("\n📋 Contract Addresses:\n");
  console.log(`Mock USDC:              ${stablecoinAddress}`);
  console.log(`MockLendingPool:        ${lendingPoolAddress}`);
  console.log(`ReputationScorer:       ${reputationScorerAddress}`);
  console.log(`DutchAuctionLiquidator: ${liquidatorAddress}`);
  console.log(`HealthFactorMonitor:    ${healthMonitorAddress}`);
  console.log(`InsuranceFund:          ${insuranceFundAddress}`);
  console.log("\n");

  // ===== SAVE ADDRESSES =====
  console.log("💾 Saving deployment addresses...");
  const fs = require("fs");
  const deploymentData = {
    network: "arbitrumSepolia",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockUSDC: stablecoinAddress,
      MockLendingPool: lendingPoolAddress,
      ReputationScorer: reputationScorerAddress,
      DutchAuctionLiquidator: liquidatorAddress,
      HealthFactorMonitor: healthMonitorAddress,
      InsuranceFund: insuranceFundAddress,
    },
  };

  fs.writeFileSync(
    "deployment-addresses.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("✅ Addresses saved to deployment-addresses.json\n");

  // ===== NEXT STEPS =====
  console.log("📝 Next Steps:");
  console.log("1. ✅ Contracts deployed and authorized");
  console.log("2. 🔍 Verify contracts on Arbiscan (see commands below)");
  console.log("3. 🧪 Test with manual transactions");
  console.log("4. 💰 Mint test USDC: stablecoin.mint(yourAddress, amount)");
  console.log("5. 🎯 Begin testnet testing plan\n");

  // ===== VERIFICATION COMMANDS =====
  console.log("🔍 Verification Commands:\n");
  console.log(`npx hardhat verify --network arbitrumSepolia ${stablecoinAddress} "USD Coin" "USDC"`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${lendingPoolAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${reputationScorerAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${liquidatorAddress} "${reputationScorerAddress}" "${lendingPoolAddress}"`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${healthMonitorAddress} "${reputationScorerAddress}" "${lendingPoolAddress}" "${MOCK_ORACLE}"`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${insuranceFundAddress} "${stablecoinAddress}"`);
  console.log("\n");

  // ===== QUICK TEST COMMANDS =====
  console.log("🧪 Quick Test Commands (Hardhat Console):\n");
  console.log(`const usdc = await ethers.getContractAt("MockERC20", "${stablecoinAddress}");`);
  console.log(`const scorer = await ethers.getContractAt("ReputationScorer", "${reputationScorerAddress}");`);
  console.log(`await usdc.mint(deployer.address, ethers.parseEther("100000"));`);
  console.log(`await scorer.calculateScore(deployer.address, 750);`);
  console.log("\n");

  console.log("🎊 Deployment successful! Ready for testnet testing!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
