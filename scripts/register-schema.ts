import { ethers } from "hardhat";

/**
 * @title Register EAS Schema
 * @notice Registers credit score schema on EAS Schema Registry
 */

async function main() {
  console.log("📋 Registering EAS Schema on Arbitrum Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Schema Registry on Arbitrum Sepolia
  const SCHEMA_REGISTRY = "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797";

  // Schema definition
  const schema = "address user,uint256 score,string tier,uint256 timestamp";
  const resolver = ethers.ZeroAddress; // No resolver
  const revocable = false; // Immutable

  console.log("Schema Definition:");
  console.log("  Fields:", schema);
  console.log("  Resolver:", resolver);
  console.log("  Revocable:", revocable);
  console.log();

  // Create SchemaRegistry contract instance
  const schemaRegistry = await ethers.getContractAt(
    [
      "event Registered(bytes32 indexed uid, address indexed registerer, string schema, address resolver, bool revocable)",
      "function register(string schema, address resolver, bool revocable) external returns (bytes32)"
    ],
    SCHEMA_REGISTRY
  );

  console.log("🚀 Submitting schema registration transaction...");

  try {
    const tx = await schemaRegistry.register(schema, resolver, revocable);
    console.log("Transaction hash:", tx.hash);
    console.log("⏳ Waiting for confirmation...\n");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log();

    // Parse Registered event from logs
    let schemaUID: string | null = null;

    for (const log of receipt.logs) {
      try {
        const parsedLog = schemaRegistry.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });

        if (parsedLog?.name === "Registered") {
          schemaUID = parsedLog.args.uid;
          console.log("📝 Schema Registered Event:");
          console.log("  UID:", schemaUID);
          console.log("  Registerer:", parsedLog.args.registerer);
          console.log("  Schema:", parsedLog.args.schema);
          console.log("  Resolver:", parsedLog.args.resolver);
          console.log("  Revocable:", parsedLog.args.revocable);
          break;
        }
      } catch (e) {
        // Skip unparseable logs
        continue;
      }
    }

    if (schemaUID) {
      console.log();
      console.log("=" .repeat(60));
      console.log("🎉 SCHEMA REGISTRATION COMPLETE");
      console.log("=" .repeat(60));
      console.log();
      console.log("Schema UID:", schemaUID);
      console.log();
      console.log("🔗 View on EAS Scan:");
      console.log(`  https://arbitrum-sepolia.easscan.org/schema/view/${schemaUID}`);
      console.log();
      console.log("📋 Next Steps:");
      console.log("  1. Update EAS_SCHEMA_UID in .env.local:");
      console.log(`     EAS_SCHEMA_UID=${schemaUID}`);
      console.log("  2. Update ScoreAttestor contract:");
      console.log(`     npx hardhat run scripts/update-schema.ts --network arbitrumSepolia`);
      console.log();

      // Save to file
      const fs = require('fs');
      const schemaInfo = `EAS_SCHEMA_UID=${schemaUID}\n`;
      fs.appendFileSync('.env', schemaInfo);
      console.log("✅ Added EAS_SCHEMA_UID to .env file");
    } else {
      console.log("⚠️  Warning: Could not extract schema UID from event logs");
      console.log("   Please check the transaction on Arbiscan");
    }

  } catch (error: any) {
    console.error("❌ Error registering schema:", error.message);

    if (error.message.includes("AlreadyExists")) {
      console.log();
      console.log("ℹ️  This schema may already be registered.");
      console.log("   Query existing schemas at:");
      console.log("   https://arbitrum-sepolia.easscan.org/schemas");
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
