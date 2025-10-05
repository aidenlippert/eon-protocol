import { ethers } from "hardhat";

/**
 * @title Update ScoreAttestor Schema UID
 * @notice Updates schema UID to registered EAS schema
 */

async function main() {
  const ATTESTOR_ADDRESS = "0xECb3AD5B42F59f3E6D688cA48525472aE458B3EB";
  const NEW_SCHEMA_UID = "0xa95fcd59af8d90bf6d492c6034d13b81373099d20f571955aa554beb842fa4aa";

  console.log("🔄 Updating ScoreAttestor Schema UID...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get ScoreAttestor contract
  const attestor = await ethers.getContractAt("ScoreAttestor", ATTESTOR_ADDRESS);

  // Check current schema
  const currentSchema = await attestor.creditScoreSchema();
  console.log("Current Schema UID:", currentSchema);
  console.log("New Schema UID:    ", NEW_SCHEMA_UID);
  console.log();

  if (currentSchema === NEW_SCHEMA_UID) {
    console.log("✅ Schema UID already up to date!");
    return;
  }

  // Update schema
  console.log("🚀 Updating schema...");
  const tx = await attestor.updateSchema(NEW_SCHEMA_UID);
  console.log("Transaction hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...\n");

  const receipt = await tx.wait();
  console.log("✅ Schema updated!");
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log();

  // Verify update
  const updatedSchema = await attestor.creditScoreSchema();
  console.log("=" .repeat(60));
  console.log("✅ SCHEMA UPDATE COMPLETE");
  console.log("=" .repeat(60));
  console.log();
  console.log("Updated Schema UID:", updatedSchema);
  console.log();
  console.log("🔗 View Schema:");
  console.log(`  https://arbitrum-sepolia.easscan.org/schema/view/${updatedSchema}`);
  console.log();
  console.log("🔗 View Contract:");
  console.log(`  https://sepolia.arbiscan.io/address/${ATTESTOR_ADDRESS}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
