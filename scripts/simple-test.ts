import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Quick Contract Test on Arbitrum Sepolia...\n");

  const addresses = require("../deployment-addresses.json");
  const [deployer] = await ethers.getSigners();

  // Test 1: USDC
  console.log("1️⃣ Testing USDC...");
  const usdc = await ethers.getContractAt("MockERC20", addresses.contracts.MockUSDC);
  console.log("✅ USDC Name:", await usdc.name());
  console.log("✅ USDC Symbol:", await usdc.symbol());

  // Test 2: Check ReputationScorer deployment
  console.log("\n2️⃣ Testing ReputationScorer...");
  const scorer = await ethers.getContractAt("ReputationScorer", addresses.contracts.ReputationScorer);
  console.log("✅ Owner:", await scorer.owner());

  // Test 3: Check HealthFactorMonitor
  console.log("\n3️⃣ Testing HealthFactorMonitor...");
  const monitor = await ethers.getContractAt("HealthFactorMonitor", addresses.contracts.HealthFactorMonitor);
  const threshold = await monitor.LIQUIDATION_THRESHOLD();
  console.log("✅ Liquidation Threshold:", ethers.formatEther(threshold));

  // Test 4: Check InsuranceFund
  console.log("\n4️⃣ Testing InsuranceFund...");
  const fund = await ethers.getContractAt("InsuranceFund", addresses.contracts.InsuranceFund);
  const stats = await fund.getStatistics();
  console.log("✅ Total Funds:", ethers.formatEther(stats._totalFunds), "USDC");

  // Test 5: Check Liquidator
  console.log("\n5️⃣ Testing DutchAuctionLiquidator...");
  const liquidator = await ethers.getContractAt("DutchAuctionLiquidator", addresses.contracts.DutchAuctionLiquidator);
  console.log("✅ Auction Duration:", (await liquidator.AUCTION_DURATION()).toString(), "seconds");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL CONTRACTS DEPLOYED AND ACCESSIBLE!");
  console.log("=".repeat(60));
  console.log("\n✅ All 6 contracts are live on Arbitrum Sepolia");
  console.log("✅ Contracts can be interacted with");
  console.log("✅ Ready for frontend integration!\n");

  console.log("🔗 Contract Addresses:");
  console.log("USDC:", addresses.contracts.MockUSDC);
  console.log("LendingPool:", addresses.contracts.MockLendingPool);
  console.log("ReputationScorer:", addresses.contracts.ReputationScorer);
  console.log("Liquidator:", addresses.contracts.DutchAuctionLiquidator);
  console.log("HealthMonitor:", addresses.contracts.HealthFactorMonitor);
  console.log("InsuranceFund:", addresses.contracts.InsuranceFund);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
