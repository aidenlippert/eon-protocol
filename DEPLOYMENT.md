# 🚀 Eon Protocol Deployment Guide

Step-by-step guide to deploy Eon Protocol v1 to Arbitrum Sepolia testnet.

---

## Prerequisites

**Required**:
- Node.js 18+ and npm/yarn
- Arbitrum Sepolia ETH (get from [faucet](https://faucet.quicknode.com/arbitrum/sepolia))
- Arbiscan API key (get from [arbiscan.io](https://arbiscan.io/apis))
- Private key with testnet ETH

**Recommended**:
- 0.5 ETH on Arbitrum Sepolia (for deployment + testing)
- Alchemy or Infura RPC endpoint (optional, public RPC works)

---

## Step 1: Environment Setup

### 1.1 Install Dependencies
```bash
npm install
```

### 1.2 Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
ARBISCAN_API_KEY=YOUR_ARBISCAN_API_KEY

# Optional (uses defaults if not set)
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
TREASURY_ADDRESS=0xYOUR_TREASURY_ADDRESS  # Defaults to deployer
ATTESTER_ADDRESS=0xYOUR_BACKEND_ADDRESS   # Defaults to deployer
```

### 1.3 Verify Setup
```bash
# Check balance
npx hardhat run scripts/check-balance.ts --network arbitrumSepolia

# Compile contracts
npx hardhat compile
```

---

## Step 2: Deploy Contracts

### 2.1 Run Deployment Script
```bash
npx hardhat run scripts/deploy-testnet.ts --network arbitrumSepolia
```

**Expected Output**:
```
🚀 Starting Eon Protocol v1 Testnet Deployment...

📍 Network: arbitrum-sepolia (ChainID: 421614)
👤 Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
💰 Balance: 0.5 ETH

⚙️  Configuration:
   Treasury: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
   Attester: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

📝 [1/4] Deploying CreditRegistryV1_1...
   ✅ CreditRegistryV1_1: 0x1234567890abcdef...

📝 [2/4] Deploying LendingPoolV1...
   ✅ LendingPoolV1: 0xabcdef1234567890...

📝 [3/4] Deploying HealthFactorMonitor...
   ✅ HealthFactorMonitor: 0x7890abcdef123456...

📝 [4/4] Deploying InsuranceFund...
   ✅ InsuranceFund: 0x4567890abcdef123...

⚙️  Post-Deployment Configuration...
   [1/2] Setting authorized attester...
   ✅ Attester authorized
   [2/2] Linking InsuranceFund to LendingPool...
   ✅ InsuranceFund linked

💾 Deployment info saved: deployments/arbitrum-sepolia-1234567890.json

✅ Deployment Complete!
```

### 2.2 Save Deployment Addresses
The deployment script automatically saves all addresses to `deployments/arbitrum-sepolia-<timestamp>.json`:
```json
{
  "creditRegistry": "0x1234...",
  "lendingPool": "0xabcd...",
  "healthFactorMonitor": "0x7890...",
  "insuranceFund": "0x4567...",
  "treasury": "0x742d...",
  "attester": "0x742d...",
  "deployer": "0x742d...",
  "network": "arbitrum-sepolia",
  "timestamp": 1234567890
}
```

---

## Step 3: Verify Contracts on Arbiscan

### 3.1 Verify CreditRegistryV1_1
```bash
npx hardhat verify --network arbitrumSepolia \
  0xCREDIT_REGISTRY_ADDRESS \
  0xTREASURY_ADDRESS
```

### 3.2 Verify LendingPoolV1
```bash
npx hardhat verify --network arbitrumSepolia \
  0xLENDING_POOL_ADDRESS \
  0xCREDIT_REGISTRY_ADDRESS \
  0xTREASURY_ADDRESS
```

### 3.3 Verify HealthFactorMonitor
```bash
npx hardhat verify --network arbitrumSepolia \
  0xMONITOR_ADDRESS \
  0xLENDING_POOL_ADDRESS
```

### 3.4 Verify InsuranceFund
```bash
npx hardhat verify --network arbitrumSepolia \
  0xINSURANCE_FUND_ADDRESS \
  0xLENDING_POOL_ADDRESS \
  0xTREASURY_ADDRESS
```

**Note**: The deployment script outputs all verification commands. Copy-paste them directly!

---

## Step 4: Enable Assets

### 4.1 Get Asset Addresses

**Arbitrum Sepolia Test Tokens**:
- USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- WETH: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`

**Chainlink Price Feeds**:
- ETH/USD: `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`
- BTC/USD: `0x0c9973e7a27d00e656B9f153348dA46CaD70d03d`

### 4.2 Enable USDC (Borrow Asset)
```bash
npx hardhat console --network arbitrumSepolia
```

```javascript
const lendingPool = await ethers.getContractAt("LendingPoolV1", "0xLENDING_POOL_ADDRESS");

// Enable USDC for borrowing
await lendingPool.enableAsset(
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",  // USDC
  6,                                              // 6 decimals
  "0x0153002d20B96532C639313c2d54c3dA09109309",  // USDC price feed
  true,                                           // Can be used as collateral
  true                                            // Can be borrowed
);
```

### 4.3 Enable WETH (Collateral Asset)
```javascript
await lendingPool.enableAsset(
  "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",  // WETH
  18,                                             // 18 decimals
  "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",  // ETH/USD price feed
  true,                                           // Can be used as collateral
  false                                           // Cannot be borrowed (optional)
);
```

---

## Step 5: Fund Insurance Fund

### 5.1 Get Test USDC
Request USDC from Arbitrum Sepolia faucet or use a test token faucet.

### 5.2 Deposit to Insurance Fund
```javascript
const usdc = await ethers.getContractAt("IERC20", "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");
const insuranceFund = await ethers.getContractAt("InsuranceFund", "0xINSURANCE_FUND_ADDRESS");

// Approve
await usdc.approve(insuranceFund.address, ethers.parseUnits("10000", 6));

// Deposit 10K USDC
await insuranceFund.deposit("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", ethers.parseUnits("10000", 6));
```

---

## Step 6: Setup Chainlink Automation (Optional)

### 6.1 Register Upkeep

1. Visit [Chainlink Automation](https://automation.chain.link)
2. Click "Register New Upkeep"
3. Select "Custom Logic"
4. Enter HealthFactorMonitor address: `0xMONITOR_ADDRESS`
5. Set upkeep name: "Eon Protocol Liquidation Monitor"
6. Set gas limit: 500,000
7. Set check frequency: Every 10 blocks
8. Fund with 5 LINK

### 6.2 Verify Automation
```javascript
const monitor = await ethers.getContractAt("HealthFactorMonitor", "0xMONITOR_ADDRESS");

// Check if monitoring is enabled
console.log(await monitor.monitoringEnabled());  // Should be true

// Simulate checkUpkeep
const [upkeepNeeded, performData] = await monitor.checkUpkeep("0x");
console.log("Upkeep needed:", upkeepNeeded);
```

---

## Step 7: Start Backend Credit Scoring

### 7.1 Deploy Backend Service
```bash
cd backend

# Install dependencies
npm install

# Configure .env
cp .env.example .env
# Edit with:
# - ATTESTER_PRIVATE_KEY (same as PRIVATE_KEY in contract deployment)
# - CREDIT_REGISTRY_ADDRESS (from deployment)
# - ARBISCAN_API_KEY

# Start service
npm run dev
```

### 7.2 Test Credit Scoring
```bash
# Score a test user
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xTEST_USER_ADDRESS"
  }'
```

**Expected Response**:
```json
{
  "score": 720,
  "tier": 1,
  "ltv": 75,
  "interestRateMultiplier": 90,
  "dataQuality": 2,
  "txHash": "0xABCDEF..."
}
```

---

## Step 8: Test End-to-End Flow

### 8.1 Setup Test User

```javascript
// User gets credit score
const userAddress = "0xUSER_ADDRESS";

// Backend automatically calculates and attests score
// Wait 3 days for challenge period...

// After 3 days, finalize score
const creditRegistry = await ethers.getContractAt("CreditRegistryV1_1", "0xCREDIT_REGISTRY_ADDRESS");
const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
await creditRegistry.finalizeScore(userAddress, merkleRoot);
```

### 8.2 LP Deposits Liquidity

```javascript
const lp = await ethers.getSigner();
const usdc = await ethers.getContractAt("IERC20", "0xUSDC_ADDRESS");

// Approve
await usdc.approve(lendingPool.address, ethers.parseUnits("100000", 6));

// Deposit 100K USDC
await lendingPool.deposit(usdc.address, ethers.parseUnits("100000", 6));
```

### 8.3 User Borrows

```javascript
const weth = await ethers.getContractAt("IERC20", "0xWETH_ADDRESS");

// User approves WETH collateral
await weth.connect(user).approve(lendingPool.address, ethers.parseEther("10"));

// Borrow 10K USDC against 7 WETH collateral (assuming $2000/ETH, 75% LTV)
await lendingPool.connect(user).borrow(
  usdc.address,       // Borrow asset
  weth.address,       // Collateral asset
  ethers.parseUnits("10000", 6),  // Borrow 10K USDC
  ethers.parseEther("7")          // Collateral: 7 WETH
);
```

### 8.4 Monitor Health Factor

```javascript
const healthFactor = await lendingPool.calculateHealthFactor(userAddress, 0);
console.log("Health Factor:", ethers.formatUnits(healthFactor, 18));

// Health Factor interpretation:
// > 1.5: Healthy
// 1.2-1.5: Moderate
// 1.0-1.2: Warning (at-risk)
// < 1.0: Critical (liquidatable)
```

### 8.5 Repay Loan

```javascript
// Calculate current debt (principal + interest)
const debt = await lendingPool.calculateCurrentDebt(userAddress, 0);

// Approve repayment
await usdc.connect(user).approve(lendingPool.address, debt);

// Repay
await lendingPool.connect(user).repay(0, debt);
```

---

## Troubleshooting

### Contract Verification Fails
```bash
# Try manual verification with flattened source
npx hardhat flatten contracts/CreditRegistryV1_1.sol > CreditRegistryV1_1_flat.sol

# Upload manually on Arbiscan
# Settings: Solidity 0.8.20, Optimizer 200 runs
```

### Transaction Reverts
```bash
# Increase gas limit
npx hardhat run --network arbitrumSepolia scripts/deploy-testnet.ts \
  --config hardhat.config.ts

# Check gas price
npx hardhat console --network arbitrumSepolia
> await ethers.provider.getFeeData()
```

### Price Feed Issues
```bash
# Test price feed directly
const priceFeed = await ethers.getContractAt("AggregatorV3Interface", "0xPRICE_FEED");
const [, price] = await priceFeed.latestRoundData();
console.log("Price:", price);
```

---

## Production Deployment Checklist

Before deploying to Arbitrum mainnet:

- [ ] Complete security audit (Tier 1 firm: Trail of Bits, OpenZeppelin, Consensys Diligence)
- [ ] Implement Timelock for admin functions
- [ ] Setup multi-sig for owner role (Gnosis Safe)
- [ ] Stress test with $1M+ TVL on testnet
- [ ] Bug bounty program ($100K+)
- [ ] Insurance coverage (Nexus Mutual, InsurAce)
- [ ] Monitoring and alerting (PagerDuty, Discord webhooks)
- [ ] Circuit breakers for emergency pause
- [ ] Gradual TVL caps ($1M → $10M → $100M)
- [ ] Comprehensive documentation and user guides

---

## Resources

**Testnet**:
- Arbitrum Sepolia Explorer: https://sepolia.arbiscan.io
- Faucet: https://faucet.quicknode.com/arbitrum/sepolia
- Bridge: https://bridge.arbitrum.io

**Documentation**:
- [System Overview](./SYSTEM_OVERVIEW.md)
- [Week 5-6 Deliverables](./WEEK_5-6_DELIVERABLES.md)
- [API Reference](./WEEK_5-6_DELIVERABLES.md#-api-reference)

**Support**:
- GitHub Issues: https://github.com/eon-protocol/contracts/issues
- Discord: https://discord.gg/eon-protocol
- Docs: https://docs.eon-protocol.com

---

**Ready to deploy!** 🚀
