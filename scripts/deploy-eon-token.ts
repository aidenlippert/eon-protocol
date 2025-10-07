import { ethers } from 'hardhat';

async function main() {
  console.log('\n🚀 Deploying EONToken...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // Deploy EONToken
  const EONToken = await ethers.getContractFactory('EONToken');
  const eonToken = await EONToken.deploy();
  await eonToken.waitForDeployment();

  const eonTokenAddress = await eonToken.getAddress();
  console.log('✅ EONToken deployed to:', eonTokenAddress);

  // Get initial supply
  const totalSupply = await eonToken.totalSupply();
  console.log('Total Supply:', ethers.formatEther(totalSupply), 'EON');
  console.log('Deployer Balance:', ethers.formatEther(await eonToken.balanceOf(deployer.address)), 'EON\n');

  console.log('📝 Update .env.local with:');
  console.log(`NEXT_PUBLIC_EON_TOKEN=${eonTokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
