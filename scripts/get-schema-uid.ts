import { ethers } from "hardhat";

/**
 * @title Get Schema UID from Transaction
 * @notice Retrieves schema UID from registration transaction
 */

async function main() {
  const txHash = "0x5d18a1861463ef458dd0dd56e93b38353302df71f01315765d6478c6f65119f2";

  console.log("🔍 Fetching schema UID from transaction:", txHash);
  console.log();

  const provider = ethers.provider;
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.error("❌ Transaction not found");
    return;
  }

  console.log("📋 Transaction Details:");
  console.log("  Block:", receipt.blockNumber);
  console.log("  Status:", receipt.status === 1 ? "Success" : "Failed");
  console.log("  Logs:", receipt.logs.length);
  console.log();

  // Schema Registry ABI for Registered event
  const registeredEventTopic = ethers.id("Registered(bytes32,address,string,address,bool)");

  console.log("Looking for Registered event topic:", registeredEventTopic);
  console.log();

  for (const log of receipt.logs) {
    console.log("Log:");
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics);

    if (log.topics[0] === registeredEventTopic) {
      const schemaUID = log.topics[1]; // First indexed parameter

      console.log();
      console.log("=" .repeat(60));
      console.log("✅ FOUND SCHEMA UID");
      console.log("=" .repeat(60));
      console.log();
      console.log("Schema UID:", schemaUID);
      console.log();
      console.log("🔗 View on EAS Scan:");
      console.log(`  https://arbitrum-sepolia.easscan.org/schema/view/${schemaUID}`);
      console.log();
      console.log("📋 Add to .env.local:");
      console.log(`  EAS_SCHEMA_UID=${schemaUID}`);
      console.log();

      return;
    }
  }

  console.log("⚠️  Registered event not found in logs");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
