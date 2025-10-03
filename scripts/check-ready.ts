import { ethers } from "hardhat";
import * as dotenv from "dotenv";

async function main() {
  console.log("🔍 Checking Deployment Readiness...\n");

  // Check 1: Environment file
  dotenv.config();
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.log("❌ PRIVATE_KEY not found in .env file");
    console.log("\n📝 Next Steps:");
    console.log("1. Export private key from Talisman wallet");
    console.log("2. Create .env file: echo 'PRIVATE_KEY=0x...' > .env");
    console.log("3. See TALISMAN_SETUP.md for detailed instructions\n");
    return;
  }

  console.log("✅ PRIVATE_KEY found in .env");

  // Check 2: Validate private key format
  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    console.log("⚠️  WARNING: Private key format may be incorrect");
    console.log("   Expected: 0x + 64 hex characters (66 total)");
    console.log("   Got:", privateKey.length, "characters\n");
  } else {
    console.log("✅ Private key format looks correct");
  }

  // Check 3: Get signer and address
  try {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();
    console.log("✅ Wallet connected successfully");
    console.log("   Address:", address);

    // Check 4: Check balance
    const balance = await signer.provider.getBalance(address);
    const balanceEth = ethers.formatEther(balance);

    console.log("\n💰 Balance Check:");
    console.log("   Balance:", balanceEth, "ETH");

    if (balance === 0n) {
      console.log("❌ No testnet ETH found!");
      console.log("\n📝 Get Testnet ETH:");
      console.log("1. Visit: https://faucet.quicknode.com/arbitrum/sepolia");
      console.log("2. Enter your address:", address);
      console.log("3. Request 0.1 ETH");
      console.log("4. Wait ~30 seconds and run this check again\n");
      return;
    } else if (balance < ethers.parseEther("0.01")) {
      console.log("⚠️  WARNING: Low balance (recommended: 0.05+ ETH)");
      console.log("   Deployment may fail due to insufficient gas");
      console.log("   Get more from: https://faucet.quicknode.com/arbitrum/sepolia\n");
    } else {
      console.log("✅ Sufficient balance for deployment");
    }

    // Check 5: Network connection
    const network = await signer.provider.getNetwork();
    console.log("\n🌐 Network Check:");
    console.log("   Network:", network.name);
    console.log("   Chain ID:", network.chainId.toString());

    if (network.chainId !== 421614n) {
      console.log("⚠️  WARNING: Not connected to Arbitrum Sepolia");
      console.log("   Expected Chain ID: 421614");
      console.log("   Current Chain ID:", network.chainId.toString());
    } else {
      console.log("✅ Connected to Arbitrum Sepolia testnet");
    }

    // Final status
    console.log("\n" + "=".repeat(60));
    if (balance >= ethers.parseEther("0.01") && network.chainId === 421614n) {
      console.log("🎉 ALL CHECKS PASSED - READY TO DEPLOY!");
      console.log("=".repeat(60));
      console.log("\n🚀 Deploy Command:");
      console.log("   npx hardhat run scripts/deploy.ts --network arbitrumSepolia\n");
    } else {
      console.log("⚠️  NOT READY - Please fix issues above");
      console.log("=".repeat(60));
      console.log("\nSee TALISMAN_SETUP.md for help\n");
    }

  } catch (error: any) {
    console.log("❌ Error connecting to wallet:", error.message);
    console.log("\nPlease check:");
    console.log("1. Private key is correct in .env file");
    console.log("2. Network configuration is correct");
    console.log("3. RPC endpoint is accessible\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
