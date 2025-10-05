import { ethers } from "hardhat";

/**
 * @title Compute Schema UID
 * @notice EAS schema UIDs are deterministic based on schema content
 * UID = keccak256(abi.encode(schema, resolver, revocable))
 */

async function main() {
  const schema = "address user,uint256 score,string tier,uint256 timestamp";
  const resolver = ethers.ZeroAddress;
  const revocable = false;

  console.log("Computing Schema UID...");
  console.log();
  console.log("Schema:", schema);
  console.log("Resolver:", resolver);
  console.log("Revocable:", revocable);
  console.log();

  // Encode the schema data
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["string", "address", "bool"],
    [schema, resolver, revocable]
  );

  // Compute UID
  const schemaUID = ethers.keccak256(encoded);

  console.log("=" .repeat(60));
  console.log("✅ COMPUTED SCHEMA UID");
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

  // Also query the SchemaRegistry to verify
  const SCHEMA_REGISTRY = "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797";
  const schemaRegistry = await ethers.getContractAt(
    [
      "function getSchema(bytes32 uid) external view returns (string schema, address resolver, bool revocable)"
    ],
    SCHEMA_REGISTRY
  );

  try {
    const schemaData = await schemaRegistry.getSchema(schemaUID);
    console.log("✅ Schema verified on-chain:");
    console.log("  Schema:", schemaData.schema);
    console.log("  Resolver:", schemaData.resolver);
    console.log("  Revocable:", schemaData.revocable);
  } catch (error) {
    console.log("⚠️  Schema not yet indexed (check EAS Scan above)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
