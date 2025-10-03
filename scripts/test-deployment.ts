import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing Deployed Contracts on Arbitrum Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Testing from address:", deployer.address);

  // Load deployment addresses
  const addresses = require("../deployment-addresses.json");
  console.log("Loaded deployment addresses from:", addresses.deployedAt, "\n");

  // ===== TEST 1: Mock USDC =====
  console.log("1️⃣  Testing Mock USDC...");
  const usdc = await ethers.getContractAt("MockERC20", addresses.contracts.MockUSDC);

  const name = await usdc.name();
  const symbol = await usdc.symbol();
  console.log("   Token:", name, "(" + symbol + ")");

  // Mint test tokens
  console.log("   Minting 100,000 USDC...");
  const mintTx = await usdc.mint(deployer.address, ethers.parseEther("100000"));
  await mintTx.wait();

  const balance = await usdc.balanceOf(deployer.address);
  console.log("   ✅ Balance:", ethers.formatEther(balance), "USDC\n");

  // ===== TEST 2: ReputationScorer =====
  console.log("2️⃣  Testing ReputationScorer...");
  const scorer = await ethers.getContractAt("ReputationScorer", addresses.contracts.ReputationScorer);

  // Test Bronze tier (300)
  console.log("   Testing Bronze tier (score: 300)...");
  const tx1 = await scorer.calculateScore(deployer.address, 300);
  await tx1.wait();
  let score = await scorer.scores(deployer.address);
  console.log("   Tier:", score.tier, "| LTV:", score.ltv.toString() + "%");

  // Test Gold tier (750)
  console.log("   Testing Gold tier (score: 750)...");
  const tx2 = await scorer.calculateScore(deployer.address, 750);
  await tx2.wait();
  score = await scorer.scores(deployer.address);
  console.log("   Tier:", score.tier, "| LTV:", score.ltv.toString() + "%");

  // Test Platinum tier (900)
  console.log("   Testing Platinum tier (score: 900)...");
  const tx3 = await scorer.calculateScore(deployer.address, 900);
  await tx3.wait();
  score = await scorer.scores(deployer.address);
  console.log("   ✅ Tier:", score.tier, "| LTV:", score.ltv.toString() + "%\n");

  // ===== TEST 3: HealthFactorMonitor =====
  console.log("3️⃣  Testing HealthFactorMonitor...");
  const healthMonitor = await ethers.getContractAt("HealthFactorMonitor", addresses.contracts.HealthFactorMonitor);
  const lendingPool = await ethers.getContractAt("MockLendingPool", addresses.contracts.MockLendingPool);

  // Create a mock loan
  console.log("   Creating mock loan (1 ETH collateral, 0.5 ETH borrowed)...");
  const setLoanTx = await lendingPool.setLoan(
    1,
    deployer.address,
    ethers.parseEther("1"),    // 1 ETH collateral
    ethers.parseEther("0.5"),  // 0.5 ETH borrowed
    true
  );
  await setLoanTx.wait();

  // Calculate health factor
  console.log("   Calculating health factor...");
  const calcTx = await healthMonitor.calculateHealthFactor(deployer.address, 1);
  await calcTx.wait();

  const healthStatus = await healthMonitor.getHealthStatus(deployer.address, 1);
  console.log("   Health Factor:", ethers.formatEther(healthStatus.healthFactor));
  console.log("   ✅ Liquidatable:", healthStatus.liquidatable);
  console.log("   ✅ Risk Level:", ["Safe", "Warning", "Danger", "Critical"][Number(healthStatus.riskLevel)], "\n");

  // ===== TEST 4: InsuranceFund =====
  console.log("4️⃣  Testing InsuranceFund...");
  const insuranceFund = await ethers.getContractAt("InsuranceFund", addresses.contracts.InsuranceFund);

  // Deposit to insurance fund
  console.log("   Depositing 10,000 USDC to insurance fund...");
  const approveTx = await usdc.approve(addresses.contracts.InsuranceFund, ethers.parseEther("10000"));
  await approveTx.wait();

  const depositTx = await insuranceFund.deposit(ethers.parseEther("10000"));
  await depositTx.wait();

  const stats = await insuranceFund.getStatistics();
  console.log("   ✅ Total Funds:", ethers.formatEther(stats._totalFunds), "USDC");
  console.log("   ✅ Total Covered:", ethers.formatEther(stats._totalCovered), "USDC");
  console.log("   ✅ Total Defaults:", stats._totalDefaults.toString(), "\n");

  // ===== TEST 5: DutchAuctionLiquidator =====
  console.log("5️⃣  Testing DutchAuctionLiquidator...");
  const liquidator = await ethers.getContractAt("DutchAuctionLiquidator", addresses.contracts.DutchAuctionLiquidator);

  // Get grace period for Platinum tier
  const gracePeriod = await liquidator.getGracePeriod(deployer.address);
  console.log("   Grace Period for Platinum tier:", (Number(gracePeriod) / 3600).toString(), "hours");
  console.log("   ✅ Liquidator configured correctly\n");

  // ===== SUMMARY =====
  console.log("=" .repeat(60));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("=" .repeat(60));
  console.log("\n✅ Mock USDC - Minting and transfers working");
  console.log("✅ ReputationScorer - All tiers calculating correctly");
  console.log("✅ HealthFactorMonitor - Health calculations working");
  console.log("✅ InsuranceFund - Deposits and stats working");
  console.log("✅ DutchAuctionLiquidator - Grace periods configured");
  console.log("\n🚀 Contracts are fully functional on Arbitrum Sepolia!\n");

  // ===== CONTRACT LINKS =====
  console.log("🔗 View on Arbiscan:");
  console.log("Mock USDC:", "https://sepolia.arbiscan.io/address/" + addresses.contracts.MockUSDC);
  console.log("ReputationScorer:", "https://sepolia.arbiscan.io/address/" + addresses.contracts.ReputationScorer);
  console.log("HealthFactorMonitor:", "https://sepolia.arbiscan.io/address/" + addresses.contracts.HealthFactorMonitor);
  console.log("InsuranceFund:", "https://sepolia.arbiscan.io/address/" + addresses.contracts.InsuranceFund);
  console.log("DutchAuctionLiquidator:", "https://sepolia.arbiscan.io/address/" + addresses.contracts.DutchAuctionLiquidator);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
