import { ChronosScanner } from './scanner';
import { CreditEngine } from './credit-engine';
import { ethers } from 'ethers';

/**
 * EON PROTOCOL INDEXER
 *
 * Main entry point for temporal reputation system
 *
 * Components:
 * 1. Scanner - Monitors on-chain claims
 * 2. Validator - Verifies claims against archive nodes
 * 3. Credit Engine - Manages reputation scores and credit limits
 */

async function main() {
  console.log('🚀 Starting Eon Protocol Indexer...\n');

  // Validate environment
  const requiredEnvVars = [
    'ALCHEMY_API_KEY',
    'RPC_URL',
    'CLAIM_MANAGER_ADDRESS'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required env var: ${envVar}`);
    }
  }

  // Initialize credit engine
  const creditEngine = new CreditEngine(
    process.env.ALCHEMY_API_KEY!,
    process.env.RPC_URL!
  );

  // Initialize scanner
  const scanner = new ChronosScanner({
    rpcUrl: process.env.WS_RPC_URL || process.env.RPC_URL!,
    claimManagerAddress: process.env.CLAIM_MANAGER_ADDRESS!,
    startBlock: parseInt(process.env.START_BLOCK || '0')
  });

  // Start scanning
  await scanner.start();

  // Example: Query credit profile
  if (process.env.EXAMPLE_ADDRESS) {
    console.log('\n📊 Example Credit Profile Query:\n');
    const profile = await creditEngine.getCreditProfile(process.env.EXAMPLE_ADDRESS);

    console.log(`Address: ${profile.userAddress}`);
    console.log(`Reputation Score: ${profile.reputationScore}/1000`);
    console.log(`Risk Tier: ${profile.riskTier}`);
    console.log(`LTV: ${profile.ltv}%`);
    console.log(`Current Balance: ${ethers.formatEther(profile.currentBalance)} ETH`);
    console.log(`Active Debt: ${ethers.formatEther(profile.activeDebt)} ETH`);
    console.log(`Available Credit: ${ethers.formatEther(profile.availableCredit)} ETH`);
    console.log(`Claims Accepted: ${profile.claimsAccepted}`);
    console.log(`Account Age: ${profile.accountAge} months\n`);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await scanner.stop();
    process.exit(0);
  });

  console.log('✅ Indexer running. Press Ctrl+C to stop.\n');
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
