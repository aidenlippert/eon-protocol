import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Phase 1 Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from address:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString(), "\n");

  // ===== STEP 1: Deploy ReputationScorer =====
  console.log("1️⃣  Deploying ReputationScorer...");
  const ReputationScorer = await ethers.getContractFactory("ReputationScorer");
  const reputationScorer = await ReputationScorer.deploy();
  await reputationScorer.waitForDeployment();
  const reputationScorerAddress = await reputationScorer.getAddress();
  console.log("✅ ReputationScorer deployed to:", reputationScorerAddress, "\n");

  // ===== STEP 2: Get existing LendingPool address =====
  const LENDING_POOL_ADDRESS = "0x43b092a9557b4f53514a6021e6aC51bE3D484F59"; // From earlier deployment
  console.log("2️⃣  Using existing LendingPool:", LENDING_POOL_ADDRESS, "\n");

  // ===== STEP 3: Deploy DutchAuctionLiquidator =====
  console.log("3️⃣  Deploying DutchAuctionLiquidator...");
  const DutchAuctionLiquidator = await ethers.getContractFactory("DutchAuctionLiquidator");
  const liquidator = await DutchAuctionLiquidator.deploy(
    reputationScorerAddress,
    LENDING_POOL_ADDRESS
  );
  await liquidator.waitForDeployment();
  const liquidatorAddress = await liquidator.getAddress();
  console.log("✅ DutchAuctionLiquidator deployed to:", liquidatorAddress, "\n");

  // ===== STEP 4: Deploy Price Oracle (mock for now) =====
  console.log("4️⃣  Deploying MockPriceOracle...");
  // TODO: Replace with Chainlink oracle in production
  const MOCK_ORACLE = "0x0000000000000000000000000000000000000001"; // Placeholder
  console.log("⚠️  Using mock oracle (replace in production):", MOCK_ORACLE, "\n");

  // ===== STEP 5: Deploy HealthFactorMonitor =====
  console.log("5️⃣  Deploying HealthFactorMonitor...");
  const HealthFactorMonitor = await ethers.getContractFactory("HealthFactorMonitor");
  const healthMonitor = await HealthFactorMonitor.deploy(
    reputationScorerAddress,
    LENDING_POOL_ADDRESS,
    MOCK_ORACLE
  );
  await healthMonitor.waitForDeployment();
  const healthMonitorAddress = await healthMonitor.getAddress();
  console.log("✅ HealthFactorMonitor deployed to:", healthMonitorAddress, "\n");

  // ===== STEP 6: Deploy InsuranceFund =====
  console.log("6️⃣  Deploying InsuranceFund...");
  // Using USDC on Arbitrum Sepolia (if available, otherwise deploy mock)
  const STABLECOIN_ADDRESS = "0x0000000000000000000000000000000000000002"; // Replace with actual USDC
  const InsuranceFund = await ethers.getContractFactory("InsuranceFund");
  const insuranceFund = await InsuranceFund.deploy(STABLECOIN_ADDRESS);
  await insuranceFund.waitForDeployment();
  const insuranceFundAddress = await insuranceFund.getAddress();
  console.log("✅ InsuranceFund deployed to:", insuranceFundAddress, "\n");

  // ===== STEP 7: Setup Authorizations =====
  console.log("7️⃣  Setting up contract authorizations...");

  // Authorize LendingPool to update reputation scores
  await reputationScorer.setAuthorizedUpdater(LENDING_POOL_ADDRESS, true);
  console.log("   ✓ LendingPool authorized in ReputationScorer");

  // Authorize Liquidator to update reputation scores (for penalties)
  await reputationScorer.setAuthorizedUpdater(liquidatorAddress, true);
  console.log("   ✓ Liquidator authorized in ReputationScorer");

  // Authorize LendingPool to request insurance coverage
  await insuranceFund.setAuthorizedRequestor(LENDING_POOL_ADDRESS, true);
  console.log("   ✓ LendingPool authorized in InsuranceFund");

  console.log("\n");

  // ===== DEPLOYMENT SUMMARY =====
  console.log("=" .repeat(60));
  console.log("🎉 PHASE 1 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n📋 Contract Addresses:\n");
  console.log(`ReputationScorer:       ${reputationScorerAddress}`);
  console.log(`DutchAuctionLiquidator: ${liquidatorAddress}`);
  console.log(`HealthFactorMonitor:    ${healthMonitorAddress}`);
  console.log(`InsuranceFund:          ${insuranceFundAddress}`);
  console.log(`LendingPool (existing): ${LENDING_POOL_ADDRESS}`);
  console.log("\n");

  // ===== NEXT STEPS =====
  console.log("📝 Next Steps:");
  console.log("1. Update .env with new contract addresses");
  console.log("2. Verify contracts on Arbiscan");
  console.log("3. Update frontend contracts.ts with new addresses");
  console.log("4. Deploy backend indexer to Railway");
  console.log("5. Test end-to-end flow");
  console.log("\n");

  // ===== VERIFICATION COMMANDS =====
  console.log("🔍 Verification Commands:\n");
  console.log(`npx hardhat verify --network arbitrumSepolia ${reputationScorerAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${liquidatorAddress} "${reputationScorerAddress}" "${LENDING_POOL_ADDRESS}"`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${healthMonitorAddress} "${reputationScorerAddress}" "${LENDING_POOL_ADDRESS}" "${MOCK_ORACLE}"`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${insuranceFundAddress} "${STABLECOIN_ADDRESS}"`);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
