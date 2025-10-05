import { ethers, upgrades } from "hardhat";

/**
 * @title ScoreAttestor Deployment Script
 * @notice Deploys EAS-integrated attestation system
 *
 * **Arbitrum Sepolia Addresses**:
 * - EAS: 0xaEF4103A04090071165F78D45D83A0C0782c2B2a
 * - Schema Registry: 0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797
 */

async function main() {
  console.log("🚀 Deploying ScoreAttestor to Arbitrum Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ==================== CONFIGURATION ====================

  const EAS_ADDRESS = "0xaEF4103A04090071165F78D45D83A0C0782c2B2a";
  const SCHEMA_REGISTRY = "0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797";

  // Get deployed ScoreOracle address
  const SCORE_ORACLE = process.env.SCORE_ORACLE_ADDRESS || "0x4E5D1f581BCAE0CEfCd7c32d9Fcde283a786dc62";

  console.log("Configuration:");
  console.log("  EAS:", EAS_ADDRESS);
  console.log("  Schema Registry:", SCHEMA_REGISTRY);
  console.log("  Score Oracle:", SCORE_ORACLE);
  console.log();

  // ==================== SCHEMA ====================

  console.log("📋 Using EAS schema...");
  console.log("  Schema: address user,uint256 score,string tier,uint256 timestamp");
  console.log();

  // Use a placeholder schema UID - this will be updated after manual registration
  // Register schema manually at: https://arbitrum-sepolia.easscan.org/
  const schemaUID = process.env.EAS_SCHEMA_UID ||
                   "0x0000000000000000000000000000000000000000000000000000000000000001";

  console.log("  Schema UID:", schemaUID);
  console.log("  ⚠️  Register schema at https://arbitrum-sepolia.easscan.org/ and update EAS_SCHEMA_UID");
  console.log();

  try {
    // ==================== DEPLOY CONTRACT ====================

    console.log("📦 Deploying ScoreAttestor (UUPS Proxy)...");

    const ScoreAttestor = await ethers.getContractFactory("ScoreAttestor");
    const attestor = await upgrades.deployProxy(
      ScoreAttestor,
      [EAS_ADDRESS, schemaUID, SCORE_ORACLE],
      { kind: "uups" }
    );

    await attestor.waitForDeployment();
    const attestorAddress = await attestor.getAddress();

    console.log("✅ ScoreAttestor deployed to:", attestorAddress);
    console.log();

    // ==================== VERIFICATION ====================

    console.log("🔍 Verifying deployment...");

    const easAddress = await attestor.eas();
    const storedSchema = await attestor.creditScoreSchema();
    const oracleAddress = await attestor.scoreOracle();

    console.log("  EAS:", easAddress);
    console.log("  Schema:", storedSchema);
    console.log("  Oracle:", oracleAddress);
    console.log();

    // ==================== SUMMARY ====================

    console.log("=" .repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE");
    console.log("=" .repeat(60));
    console.log();
    console.log("📝 Contract Addresses:");
    console.log("  ScoreAttestor:", attestorAddress);
    console.log("  Implementation:", await upgrades.erc1967.getImplementationAddress(attestorAddress));
    console.log();
    console.log("🔗 EAS Configuration:");
    console.log("  Schema UID:", schemaUID);
    console.log("  EAS Contract:", EAS_ADDRESS);
    console.log();
    console.log("📋 Next Steps:");
    console.log("  1. Register schema at https://arbitrum-sepolia.easscan.org/");
    console.log("  2. Update EAS_SCHEMA_UID in .env");
    console.log("  3. Call attestor.updateSchema() with real schema UID");
    console.log("  4. Update ScoreOracle to call attestor.attestScore()");
    console.log("  5. Create /api/attest endpoint");
    console.log();
    console.log("🔗 View on Explorer:");
    console.log(`  https://sepolia.arbiscan.io/address/${attestorAddress}`);
    console.log();

    // Save to .env file (append)
    const fs = require('fs');
    const envContent = `\n# EAS Attestation System (Phase 8)\nATTESTOR_ADDRESS=${attestorAddress}\nEAS_SCHEMA_UID=${schemaUID}\n`;
    fs.appendFileSync('.env', envContent);
    console.log("✅ Added to .env file");
  } catch (error: any) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
