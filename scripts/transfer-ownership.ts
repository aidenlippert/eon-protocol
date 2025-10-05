import { ethers } from 'hardhat';

async function main() {
  console.log('🔐 Transferring contract ownership to Gnosis Safe...\n');

  const [deployer] = await ethers.getSigners();
  
  // Load Safe address from config
  const fs = require('fs');
  const safeConfig = JSON.parse(fs.readFileSync('gnosis-safe-config.json', 'utf8'));
  const SAFE_ADDRESS = safeConfig.safeAddress;

  const CONTRACTS = {
    CreditRegistry: '0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9',
    ScoreOracle: '0x3460891EbdDeA80F44c56Cb97a239031C22B2b7e',
    CreditVault: '0x52F65D2A3BacE77F7dee738F439f2F106B0c5a4d',
  };

  console.log('Safe Address:', SAFE_ADDRESS);
  console.log('Deployer:', deployer.address);
  console.log('');

  const ownableAbi = ['function transferOwnership(address newOwner) public'];

  for (const [name, address] of Object.entries(CONTRACTS)) {
    console.log(`Transferring ${name}...`);
    const contract = new ethers.Contract(address, ownableAbi, deployer);
    const tx = await contract.transferOwnership(SAFE_ADDRESS);
    await tx.wait();
    console.log(`✓ ${name} ownership transferred`);
  }

  console.log('\n🎉 All contracts now owned by Gnosis Safe!');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
