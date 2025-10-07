const hre = require('hardhat');

async function main() {
  console.log('\n🚀 Deploying Multi-Wallet System...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  const CREDIT_REGISTRY_V3 = '0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9';
  console.log('Using CreditRegistryV3:', CREDIT_REGISTRY_V3, '\n');

  // 1. Deploy UserRegistry
  console.log('📋 Step 1: Deploying UserRegistry...');
  const UserRegistry = await hre.ethers.getContractFactory('UserRegistry');
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();

  const userRegistryAddress = await userRegistry.getAddress();
  console.log('✅ UserRegistry deployed to:', userRegistryAddress, '\n');

  // 2. Deploy ScoreOracleMultiWallet
  console.log('📊 Step 2: Deploying ScoreOracleMultiWallet...');
  const ScoreOracleMulti = await hre.ethers.getContractFactory('ScoreOracleMultiWallet');
  const scoreOracleMulti = await ScoreOracleMulti.deploy(CREDIT_REGISTRY_V3, userRegistryAddress);
  await scoreOracleMulti.waitForDeployment();

  const scoreOracleMultiAddress = await scoreOracleMulti.getAddress();
  console.log('✅ ScoreOracleMultiWallet deployed to:', scoreOracleMultiAddress, '\n');

  console.log('='.repeat(60));
  console.log('📝 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log('UserRegistry:', userRegistryAddress);
  console.log('ScoreOracleMultiWallet:', scoreOracleMultiAddress);
  console.log('='.repeat(60), '\n');

  console.log('📝 Update .env.local with:');
  console.log(`NEXT_PUBLIC_USER_REGISTRY=${userRegistryAddress}`);
  console.log(`NEXT_PUBLIC_SCORE_ORACLE_MULTI=${scoreOracleMultiAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
