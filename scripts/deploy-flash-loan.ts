import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying FlashLoanVaultV1...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Configuration
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const MAX_FLASH_LOAN_AMOUNT = ethers.parseEther("1000000"); // 1M max per tx

  console.log("Configuration:");
  console.log("- Treasury:", TREASURY);
  console.log("- Max Flash Loan:", ethers.formatEther(MAX_FLASH_LOAN_AMOUNT), "\n");

  // Deploy FlashLoanVaultV1
  const FlashLoanVaultFactory = await ethers.getContractFactory("FlashLoanVaultV1");

  console.log("Deploying FlashLoanVaultV1 proxy...");
  const flashLoanVault = await upgrades.deployProxy(
    FlashLoanVaultFactory,
    [TREASURY, MAX_FLASH_LOAN_AMOUNT],
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await flashLoanVault.waitForDeployment();
  const vaultAddress = await flashLoanVault.getAddress();

  console.log("✅ FlashLoanVaultV1 deployed to:", vaultAddress);

  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    vaultAddress
  );
  console.log("📋 Implementation address:", implementationAddress);

  // Verify configuration
  const treasury = await flashLoanVault.treasury();
  const maxAmount = await flashLoanVault.maxFlashLoanAmount();

  console.log("\n📊 Deployment Summary:");
  console.log("- Proxy Address:", vaultAddress);
  console.log("- Implementation:", implementationAddress);
  console.log("- Treasury:", treasury);
  console.log("- Max Flash Loan:", ethers.formatEther(maxAmount));
  console.log("- Flash Loan Premium: 0.09% (9 bps)");
  console.log("- Protocol Fee: 0.04% (4 bps to treasury)");
  console.log("- LP Fee: 0.05% (5 bps to liquidity providers)");

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    flashLoanVault: {
      proxy: vaultAddress,
      implementation: implementationAddress,
    },
    treasury: TREASURY,
    maxFlashLoanAmount: MAX_FLASH_LOAN_AMOUNT.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
  };

  console.log("\n💾 Deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Optional: Enable flash loans for specific assets
  if (process.env.ENABLE_ASSETS) {
    const assets = process.env.ENABLE_ASSETS.split(",");
    console.log("\n🔓 Enabling flash loans for assets...");

    for (const asset of assets) {
      console.log("- Enabling", asset);
      const tx = await flashLoanVault.enableFlashLoan(asset.trim());
      await tx.wait();
      console.log("  ✅ Enabled");
    }
  }

  console.log("\n✨ Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Enable flash loans for specific assets");
  console.log("3. Add liquidity to vault");
  console.log("4. Test flash loan execution");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
