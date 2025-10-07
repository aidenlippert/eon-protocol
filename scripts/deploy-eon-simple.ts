import { ethers } from 'hardhat';

async function main() {
  console.log('\n🚀 Deploying EONToken (Simple)...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Create a simple EON token just for testing
  const SimpleEON = await ethers.getContractFactory('EONToken');
  const eonToken = await SimpleEON.deploy();
  await eonToken.waitForDeployment();

  const eonTokenAddress = await eonToken.getAddress();
  console.log('✅ EONToken deployed to:', eonTokenAddress);

  // Mint some tokens to deployer for testing (if minting is available)
  try {
    // Since the constructor doesn't mint, we need to set vesting contracts first
    // For testing, let's just use the deployer address
    const tx = await eonToken.setVestingContracts(
      deployer.address, // liquidity mining
      deployer.address, // treasury
      deployer.address, // team
      deployer.address, // backers
      deployer.address  // reserve
    );
    await tx.wait();
    console.log('✅ Vesting contracts set to deployer\n');

    const tx2 = await eonToken.completeInitialMinting();
    await tx2.wait();
    console.log('✅ Initial minting completed\n');

    const balance = await eonToken.balanceOf(deployer.address);
    console.log('Deployer Balance:', ethers.formatEther(balance), 'EON');
  } catch (err) {
    console.log('Note: Could not complete initial minting, check contract manually\n');
  }

  console.log('\n📝 Update .env.local with:');
  console.log(`NEXT_PUBLIC_EON_TOKEN=${eonTokenAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
