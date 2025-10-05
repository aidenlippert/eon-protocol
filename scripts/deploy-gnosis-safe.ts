import { ethers } from 'hardhat';

/**
 * @title Deploy Gnosis Safe Multi-Sig
 * @notice Sets up Gnosis Safe for protocol governance
 * @dev Run: npx hardhat run scripts/deploy-gnosis-safe.ts --network arbitrumSepolia
 */

async function main() {
  console.log('🔐 Deploying Gnosis Safe Multi-Sig...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer address:', deployer.address);
  console.log('Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Define Safe owners (replace with actual addresses)
  const owners = [
    deployer.address, // Owner 1 (deployer)
    '0x0000000000000000000000000000000000000001', // Owner 2 (replace)
    '0x0000000000000000000000000000000000000002', // Owner 3 (replace)
  ];

  const threshold = 2; // 2 of 3 signatures required

  console.log('Safe Configuration:');
  console.log('- Owners:', owners.length);
  console.log('- Threshold:', threshold);
  console.log('- Owners:');
  owners.forEach((owner, i) => console.log(`  ${i + 1}. ${owner}`));
  console.log('');

  // Gnosis Safe factory addresses (Arbitrum Sepolia)
  const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'; // GnosisSafeProxyFactory
  const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a'; // GnosisSafe master copy

  console.log('Using Gnosis Safe contracts:');
  console.log('- Factory:', SAFE_FACTORY);
  console.log('- Singleton:', SAFE_SINGLETON);
  console.log('');

  // Factory ABI (minimal)
  const factoryAbi = [
    'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) external returns (address proxy)',
  ];

  // Safe setup ABI (minimal)
  const safeAbi = [
    'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external',
  ];

  const factory = new ethers.Contract(SAFE_FACTORY, factoryAbi, deployer);
  const safeSingleton = new ethers.Contract(SAFE_SINGLETON, safeAbi, deployer);

  // Encode setup data
  const setupData = safeSingleton.interface.encodeFunctionData('setup', [
    owners,
    threshold,
    ethers.ZeroAddress, // to
    '0x', // data
    ethers.ZeroAddress, // fallbackHandler
    ethers.ZeroAddress, // paymentToken
    0, // payment
    ethers.ZeroAddress, // paymentReceiver
  ]);

  console.log('Creating Safe...');
  const saltNonce = Date.now(); // Unique nonce
  const tx = await factory.createProxyWithNonce(SAFE_SINGLETON, setupData, saltNonce);
  console.log('Transaction hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('✓ Safe deployed!\n');

  // Extract Safe address from logs
  const safeAddress = receipt.logs[0].address;
  console.log('🎉 Gnosis Safe Address:', safeAddress);
  console.log('');

  // Save to file
  const fs = require('fs');
  const safeConfig = {
    network: 'arbitrum-sepolia',
    safeAddress,
    owners,
    threshold,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync('gnosis-safe-config.json', JSON.stringify(safeConfig, null, 2));
  console.log('✓ Safe configuration saved to gnosis-safe-config.json');
  console.log('');

  console.log('📋 Next Steps:');
  console.log('1. Transfer contract ownership to Safe:');
  console.log(`   - Run: npx hardhat run scripts/transfer-ownership.ts --network arbitrumSepolia`);
  console.log('2. Verify Safe on Arbiscan:');
  console.log(`   - https://sepolia.arbiscan.io/address/${safeAddress}`);
  console.log('3. Add owners in Gnosis Safe UI:');
  console.log(`   - https://app.safe.global/arb:${safeAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
