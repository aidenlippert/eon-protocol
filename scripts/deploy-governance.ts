import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🏛️  Deploying EON Governance System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============ 1. Deploy EON Token ============
  console.log("📜 Deploying EON Token...");
  const EONTokenFactory = await ethers.getContractFactory("EONToken");
  const eonToken = await EONTokenFactory.deploy();
  await eonToken.waitForDeployment();
  const tokenAddress = await eonToken.getAddress();
  console.log("✅ EON Token deployed to:", tokenAddress);

  // ============ 2. Deploy Timelock Controller ============
  const MIN_DELAY = 2 * 24 * 60 * 60; // 2 days
  const proposers: string[] = []; // Will be set to governor after deployment
  const executors: string[] = []; // Will be set to governor after deployment
  const admin = deployer.address; // Temporary admin

  console.log("\n⏱️  Deploying Timelock Controller...");
  const TimelockFactory = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockFactory.deploy(
    MIN_DELAY,
    proposers,
    executors,
    admin
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("✅ Timelock deployed to:", timelockAddress);
  console.log("   Min delay:", MIN_DELAY / (24 * 60 * 60), "days");

  // ============ 3. Deploy EON Governor ============
  console.log("\n🏛️  Deploying EON Governor...");
  const EONGovernorFactory = await ethers.getContractFactory("EONGovernor");
  const governor = await EONGovernorFactory.deploy(
    tokenAddress,
    timelockAddress
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("✅ EON Governor deployed to:", governorAddress);

  // ============ 4. Configure Timelock Roles ============
  console.log("\n🔐 Configuring Timelock roles...");

  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  // Grant proposer role to governor
  let tx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await tx.wait();
  console.log("✅ Granted PROPOSER_ROLE to governor");

  // Grant executor role to governor (and anyone can execute if proposal passed)
  tx = await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
  await tx.wait();
  tx = await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress); // Public execution
  await tx.wait();
  console.log("✅ Granted EXECUTOR_ROLE to governor and public");

  // Revoke admin role from deployer (DAO becomes admin)
  tx = await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Revoked admin role from deployer (DAO is now admin)");

  // ============ 5. Set Up Token Distribution ============
  console.log("\n💰 Setting up token distribution...");

  // For demo, using deployer as all vesting contracts
  // In production, deploy actual vesting contracts
  const LIQUIDITY_MINING = process.env.LIQUIDITY_MINING_ADDRESS || deployer.address;
  const TREASURY = timelockAddress; // Treasury controlled by DAO
  const TEAM = process.env.TEAM_VESTING_ADDRESS || deployer.address;
  const BACKERS = process.env.BACKERS_VESTING_ADDRESS || deployer.address;
  const RESERVE = process.env.RESERVE_ADDRESS || deployer.address;

  tx = await eonToken.setVestingContracts(
    LIQUIDITY_MINING,
    TREASURY,
    TEAM,
    BACKERS,
    RESERVE
  );
  await tx.wait();
  console.log("✅ Vesting contracts configured");

  tx = await eonToken.completeInitialMinting();
  await tx.wait();
  console.log("✅ Initial minting completed");

  const totalSupply = await eonToken.totalSupply();
  console.log("   Total supply:", ethers.formatEther(totalSupply), "EON");

  // ============ 6. Delegate Voting Power (for testing) ============
  console.log("\n🗳️  Delegating voting power to deployer...");
  tx = await eonToken.delegate(deployer.address);
  await tx.wait();
  const votes = await eonToken.getVotes(deployer.address);
  console.log("✅ Deployer votes:", ethers.formatEther(votes), "EON");

  // ============ 7. Governance Parameters ============
  const votingDelay = await governor.votingDelay();
  const votingPeriod = await governor.votingPeriod();
  const proposalThreshold = await governor.proposalThreshold();
  const quorum = await governor.quorum(await ethers.provider.getBlockNumber());

  console.log("\n📊 Governance Parameters:");
  console.log("- Voting Delay:", votingDelay.toString(), "blocks (~1 day)");
  console.log("- Voting Period:", votingPeriod.toString(), "blocks (~3 days)");
  console.log("- Proposal Threshold:", ethers.formatEther(proposalThreshold), "EON");
  console.log("- Quorum:", ethers.formatEther(quorum), "EON (4%)");

  // ============ 8. Summary ============
  console.log("\n✨ Deployment Complete!\n");
  console.log("Contract Addresses:");
  console.log("- EON Token:", tokenAddress);
  console.log("- Timelock Controller:", timelockAddress);
  console.log("- EON Governor:", governorAddress);
  console.log("\nToken Distribution:");
  console.log("- Liquidity Mining:", LIQUIDITY_MINING);
  console.log("- Community Treasury:", TREASURY, "(DAO controlled)");
  console.log("- Team Vesting:", TEAM);
  console.log("- Early Backers:", BACKERS);
  console.log("- Protocol Reserve:", RESERVE);

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    contracts: {
      eonToken: tokenAddress,
      timelock: timelockAddress,
      governor: governorAddress,
    },
    distribution: {
      liquidityMining: LIQUIDITY_MINING,
      treasury: TREASURY,
      team: TEAM,
      backers: BACKERS,
      reserve: RESERVE,
    },
    governance: {
      votingDelay: votingDelay.toString(),
      votingPeriod: votingPeriod.toString(),
      proposalThreshold: ethers.formatEther(proposalThreshold),
      quorumPercentage: "4%",
      timelockDelay: MIN_DELAY / (24 * 60 * 60) + " days",
    },
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
  };

  console.log("\n💾 Deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎯 Next Steps:");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Create first governance proposal");
  console.log("3. Deploy vesting contracts for team/backers");
  console.log("4. Transfer ownership of protocol contracts to DAO");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
