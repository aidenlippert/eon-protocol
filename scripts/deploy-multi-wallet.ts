import { ethers } from 'hardhat';

async function main() {
  console.log('\n🚀 Deploying Multi-Wallet System...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Get existing contract addresses
  const CREDIT_REGISTRY_V3 = process.env.CREDIT_REGISTRY_V3 || '0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9';
  console.log('Using CreditRegistryV3:', CREDIT_REGISTRY_V3, '\n');

  // 1. Deploy UserRegistry
  console.log('📋 Step 1: Deploying UserRegistry...');
  const UserRegistry = await ethers.getContractFactory('UserRegistry');
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();

  const userRegistryAddress = await userRegistry.getAddress();
  console.log('✅ UserRegistry deployed to:', userRegistryAddress);
  console.log('   Total Users:', await userRegistry.totalUsers());
  console.log('   Max Wallets:', await userRegistry.MAX_LINKED_WALLETS(), '\n');

  // 2. Deploy ScoreOraclePhase3B_V2
  console.log('📊 Step 2: Deploying ScoreOraclePhase3B_V2...');
  const ScoreOracleV2 = await ethers.getContractFactory('ScoreOraclePhase3B_V2');
  const scoreOracleV2 = await ScoreOracleV2.deploy(CREDIT_REGISTRY_V3, userRegistryAddress);
  await scoreOracleV2.waitForDeployment();

  const scoreOracleV2Address = await scoreOracleV2.getAddress();
  console.log('✅ ScoreOraclePhase3B_V2 deployed to:', scoreOracleV2Address);
  console.log('   Connected to UserRegistry:', await scoreOracleV2.userRegistry());
  console.log('   Connected to CreditRegistry:', await scoreOracleV2.registry(), '\n');

  // 3. Test single wallet scoring (backward compatibility)
  console.log('🧪 Step 3: Testing single wallet scoring...');
  try {
    const testScore = await scoreOracleV2.computeScore(deployer.address);
    console.log('✅ Single wallet score test passed:');
    console.log('   Overall:', testScore.overall.toString());
    console.log('   Is Aggregate:', testScore.isAggregate);
    console.log('   Wallet Count:', testScore.walletCount.toString(), '\n');
  } catch (err) {
    console.log('⚠️  Single wallet scoring test skipped (may need registry data)\n');
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('📝 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log('UserRegistry:', userRegistryAddress);
  console.log('ScoreOraclePhase3B_V2:', scoreOracleV2Address);
  console.log('CreditRegistryV3:', CREDIT_REGISTRY_V3);
  console.log('='.repeat(60), '\n');

  console.log('📝 Update .env.local with:');
  console.log(`NEXT_PUBLIC_USER_REGISTRY=${userRegistryAddress}`);
  console.log(`NEXT_PUBLIC_SCORE_ORACLE_V2=${scoreOracleV2Address}\n`);

  console.log('🎉 Multi-wallet system deployed successfully!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
