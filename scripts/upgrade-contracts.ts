import { ethers, upgrades } from 'hardhat';

/**
 * @title UUPS Contract Upgrade Script
 * @notice Upgrades EON Protocol contracts using UUPS pattern
 * @dev Run: TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/upgrade-contracts.ts --network arbitrumSepolia
 */

async function main() {
  console.log('🔄 Starting contract upgrade process...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Upgrader address:', deployer.address);
  console.log('Upgrader balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Current proxy addresses (from deployment)
  const CREDIT_REGISTRY_PROXY = '0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9';
  const SCORE_ORACLE_PROXY = '0x3460891EbdDeA80F44c56Cb97a239031C22B2b7e';
  const CREDIT_VAULT_PROXY = '0x52F65D2A3BacE77F7dee738F439f2F106B0c5a4d';

  console.log('Current Proxy Addresses:');
  console.log('- CreditRegistryV3:', CREDIT_REGISTRY_PROXY);
  console.log('- ScoreOraclePhase3B:', SCORE_ORACLE_PROXY);
  console.log('- CreditVaultV3:', CREDIT_VAULT_PROXY);
  console.log('');

  // === UPGRADE CREDITREGISTRYV3 ===
  console.log('📦 Upgrading CreditRegistryV3...');
  const CreditRegistryV4 = await ethers.getContractFactory('CreditRegistryV3'); // Change to V4 when ready
  const registryUpgrade = await upgrades.upgradeProxy(CREDIT_REGISTRY_PROXY, CreditRegistryV4);
  await registryUpgrade.waitForDeployment();
  const newRegistryImpl = await upgrades.erc1967.getImplementationAddress(CREDIT_REGISTRY_PROXY);
  console.log('✓ CreditRegistry upgraded!');
  console.log('  New implementation:', newRegistryImpl);
  console.log('');

  // === UPGRADE SCOREORACLE ===
  console.log('📦 Upgrading ScoreOraclePhase3B...');
  const ScoreOracleV4 = await ethers.getContractFactory('ScoreOraclePhase3B'); // Change to V4 when ready
  const oracleUpgrade = await upgrades.upgradeProxy(SCORE_ORACLE_PROXY, ScoreOracleV4);
  await oracleUpgrade.waitForDeployment();
  const newOracleImpl = await upgrades.erc1967.getImplementationAddress(SCORE_ORACLE_PROXY);
  console.log('✓ ScoreOracle upgraded!');
  console.log('  New implementation:', newOracleImpl);
  console.log('');

  // === UPGRADE CREDITVAULT ===
  console.log('📦 Upgrading CreditVaultV3...');
  const CreditVaultV4 = await ethers.getContractFactory('CreditVaultV3'); // Change to V4 when ready
  const vaultUpgrade = await upgrades.upgradeProxy(CREDIT_VAULT_PROXY, CreditVaultV4);
  await vaultUpgrade.waitForDeployment();
  const newVaultImpl = await upgrades.erc1967.getImplementationAddress(CREDIT_VAULT_PROXY);
  console.log('✓ CreditVault upgraded!');
  console.log('  New implementation:', newVaultImpl);
  console.log('');

  // Save upgrade info
  const fs = require('fs');
  const upgradeInfo = {
    network: 'arbitrum-sepolia',
    upgradedAt: new Date().toISOString(),
    upgrader: deployer.address,
    contracts: {
      CreditRegistry: {
        proxy: CREDIT_REGISTRY_PROXY,
        newImplementation: newRegistryImpl,
      },
      ScoreOracle: {
        proxy: SCORE_ORACLE_PROXY,
        newImplementation: newOracleImpl,
      },
      CreditVault: {
        proxy: CREDIT_VAULT_PROXY,
        newImplementation: newVaultImpl,
      },
    },
  };

  fs.writeFileSync(`upgrade-${Date.now()}.json`, JSON.stringify(upgradeInfo, null, 2));
  console.log('✓ Upgrade info saved');
  console.log('');

  console.log('🎉 All contracts upgraded successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
