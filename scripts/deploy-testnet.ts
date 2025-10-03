import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy Eon Protocol v1 to Arbitrum Sepolia Testnet
 *
 * Deployment Order:
 * 1. CreditRegistryV1_1 (oracle for credit scores)
 * 2. LendingPoolV1 (core lending logic)
 * 3. HealthFactorMonitor (liquidation monitoring)
 * 4. InsuranceFund (protocol safety net)
 *
 * Post-Deployment:
 * - Set authorized attesters for CreditRegistry
 * - Enable borrow/collateral assets
 * - Fund InsuranceFund with initial capital
 * - Configure HealthFactorMonitor keeper
 */

interface DeploymentAddresses {
  creditRegistry: string;
  lendingPool: string;
  healthFactorMonitor: string;
  insuranceFund: string;
  treasury: string;
  attester: string;
  deployer: string;
  network: string;
  timestamp: number;
}

async function main() {
  console.log("🚀 Starting Eon Protocol v1 Testnet Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📍 Network:", network.name, `(ChainID: ${network.chainId})`);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Configuration
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;
  const ATTESTER = process.env.ATTESTER_ADDRESS || deployer.address;

  console.log("⚙️  Configuration:");
  console.log("   Treasury:", TREASURY);
  console.log("   Attester:", ATTESTER);
  console.log();

  // Deployment tracking
  const addresses: DeploymentAddresses = {
    creditRegistry: "",
    lendingPool: "",
    healthFactorMonitor: "",
    insuranceFund: "",
    treasury: TREASURY,
    attester: ATTESTER,
    deployer: deployer.address,
    network: network.name,
    timestamp: Date.now(),
  };

  // ============ 1. Deploy CreditRegistryV1_1 ============
  console.log("📝 [1/4] Deploying CreditRegistryV1_1...");
  const CreditRegistryFactory = await ethers.getContractFactory("CreditRegistryV1_1");
  const creditRegistry = await CreditRegistryFactory.deploy(TREASURY);
  await creditRegistry.waitForDeployment();
  addresses.creditRegistry = await creditRegistry.getAddress();
  console.log("   ✅ CreditRegistryV1_1:", addresses.creditRegistry);
  console.log();

  // ============ 2. Deploy LendingPoolV1 ============
  console.log("📝 [2/4] Deploying LendingPoolV1...");
  const LendingPoolFactory = await ethers.getContractFactory("LendingPoolV1");
  const lendingPool = await LendingPoolFactory.deploy(
    addresses.creditRegistry,
    TREASURY
  );
  await lendingPool.waitForDeployment();
  addresses.lendingPool = await lendingPool.getAddress();
  console.log("   ✅ LendingPoolV1:", addresses.lendingPool);
  console.log();

  // ============ 3. Deploy ReputationScorer (dependency) ============
  console.log("📝 [3/6] Deploying ReputationScorer...");
  const ReputationScorerFactory = await ethers.getContractFactory("ReputationScorer");
  const reputationScorer = await ReputationScorerFactory.deploy();
  await reputationScorer.waitForDeployment();
  const reputationScorerAddress = await reputationScorer.getAddress();
  console.log("   ✅ ReputationScorer:", reputationScorerAddress);
  console.log();

  // ============ 4. Deploy Mock Price Oracle (for testing) ============
  console.log("📝 [4/6] Deploying Mock Price Oracle...");
  const MockPriceOracleFactory = await ethers.getContractFactory("MockV3Aggregator");
  const mockPriceOracle = await MockPriceOracleFactory.deploy(8, 200000000000); // $2000 with 8 decimals
  await mockPriceOracle.waitForDeployment();
  const mockPriceOracleAddress = await mockPriceOracle.getAddress();
  console.log("   ✅ MockPriceOracle:", mockPriceOracleAddress);
  console.log();

  // ============ 5. Deploy HealthFactorMonitor ============
  console.log("📝 [5/6] Deploying HealthFactorMonitor...");
  const MonitorFactory = await ethers.getContractFactory("HealthFactorMonitor");
  const healthFactorMonitor = await MonitorFactory.deploy(
    reputationScorerAddress,
    addresses.lendingPool,
    mockPriceOracleAddress
  );
  await healthFactorMonitor.waitForDeployment();
  addresses.healthFactorMonitor = await healthFactorMonitor.getAddress();
  console.log("   ✅ HealthFactorMonitor:", addresses.healthFactorMonitor);
  console.log();

  // ============ 6. Deploy Mock USDC (for InsuranceFund) ============
  console.log("📝 [6/7] Deploying Mock USDC...");
  const MockUSDCFactory = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockUSDCFactory.deploy("USD Coin", "USDC", 6);
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("   ✅ MockUSDC:", mockUSDCAddress);
  console.log();

  // ============ 7. Deploy InsuranceFund ============
  console.log("📝 [7/7] Deploying InsuranceFund...");
  const InsuranceFundFactory = await ethers.getContractFactory("InsuranceFund");
  const insuranceFund = await InsuranceFundFactory.deploy(mockUSDCAddress);
  await insuranceFund.waitForDeployment();
  addresses.insuranceFund = await insuranceFund.getAddress();
  console.log("   ✅ InsuranceFund:", addresses.insuranceFund);
  console.log();

  // ============ Post-Deployment Configuration ============
  console.log("⚙️  Post-Deployment Configuration...\n");

  // Set authorized attester
  console.log("   [1/2] Setting authorized attester...");
  const tx1 = await creditRegistry.setAuthorizedAttester(ATTESTER, true);
  await tx1.wait();
  console.log("   ✅ Attester authorized");

  // Note: InsuranceFund integration can be configured later
  console.log("   ✅ Post-deployment configuration complete");
  console.log();

  // ============ Save Deployment Info ============
  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const filename = `${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(addresses, null, 2));
  console.log("💾 Deployment info saved:", filepath);
  console.log();

  // ============ Deployment Summary ============
  console.log("✅ Deployment Complete!\n");
  console.log("📋 Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   CreditRegistryV1_1:    ", addresses.creditRegistry);
  console.log("   LendingPoolV1:         ", addresses.lendingPool);
  console.log("   HealthFactorMonitor:   ", addresses.healthFactorMonitor);
  console.log("   InsuranceFund:         ", addresses.insuranceFund);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();

  // ============ Next Steps ============
  console.log("📝 Next Steps:");
  console.log("   1. Verify contracts on Arbiscan:");
  console.log("      npx hardhat verify --network arbitrumSepolia <address>");
  console.log();
  console.log("   2. Enable borrow assets (USDC, DAI):");
  console.log("      await lendingPool.enableBorrowAsset(USDC_ADDRESS, 6)");
  console.log();
  console.log("   3. Enable collateral assets with price feeds:");
  console.log("      await lendingPool.enableCollateralAsset(WETH_ADDRESS, 18, WETH_PRICE_FEED)");
  console.log();
  console.log("   4. Fund InsuranceFund:");
  console.log("      Send initial capital (e.g., 100K USDC)");
  console.log();
  console.log("   5. Setup Chainlink Automation for HealthFactorMonitor:");
  console.log("      Register upkeep at automation.chain.link");
  console.log();
  console.log("   6. Start backend credit scoring service");
  console.log();

  // ============ Verification Commands ============
  console.log("🔍 Verification Commands:");
  console.log(`   npx hardhat verify --network ${network.name} ${addresses.creditRegistry} ${TREASURY}`);
  console.log(`   npx hardhat verify --network ${network.name} ${addresses.lendingPool} ${addresses.creditRegistry} ${TREASURY}`);
  console.log(`   npx hardhat verify --network ${network.name} ${addresses.healthFactorMonitor} ${addresses.lendingPool}`);
  console.log(`   npx hardhat verify --network ${network.name} ${addresses.insuranceFund} ${addresses.lendingPool} ${TREASURY}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
