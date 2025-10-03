# 🚀 Testnet Deployment - Step by Step Guide

**Status**: Ready to deploy! All contracts tested and working perfectly.

---

## ⚠️ You Need These First

### 1. Private Key (Testnet Wallet)

**Option A: Use existing testnet wallet**
- Open MetaMask
- Click on account icon → Account Details → Export Private Key
- Copy the private key (starts with `0x`)

**Option B: Create new testnet wallet**
- Visit https://vanity-eth.tk/
- Generate new wallet
- Save private key securely
- Import to MetaMask to monitor

### 2. Testnet ETH (~0.05 ETH needed)

Get Arbitrum Sepolia testnet ETH from faucets:

**Option 1: QuickNode Faucet** (Recommended)
- URL: https://faucet.quicknode.com/arbitrum/sepolia
- Enter your wallet address
- Claim 0.1 testnet ETH

**Option 2: Alchemy Faucet**
- URL: https://sepoliafaucet.com/
- Select Arbitrum Sepolia
- Enter wallet address

**Option 3: Chainlink Faucet**
- URL: https://faucets.chain.link/arbitrum-sepolia
- Connect wallet or enter address
- Claim testnet ETH

---

## 📝 Setup Steps

### Step 1: Create .env File

```bash
# Copy example file
cp .env.example .env

# Edit .env and add your private key
nano .env
# or
vim .env
# or use any text editor
```

Add this to `.env`:
```
PRIVATE_KEY=0xyour_private_key_here
```

**⚠️ IMPORTANT**:
- Private key must start with `0x`
- DO NOT commit .env file to git
- Use testnet wallet only (never mainnet keys!)

### Step 2: Verify Balance

```bash
# Check your testnet ETH balance
npx hardhat run scripts/check-balance.ts --network arbitrumSepolia
```

Or create a quick check script:

```bash
echo 'async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await signer.provider.getBalance(signer.address);
  console.log("Address:", signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️ WARNING: Low balance! Get testnet ETH from faucet");
  } else {
    console.log("✅ Sufficient balance for deployment");
  }
}
main();' > scripts/check-balance.ts

npx hardhat run scripts/check-balance.ts --network arbitrumSepolia
```

---

## 🚀 Deploy Command

Once you have:
- ✅ Private key in `.env` file
- ✅ At least 0.01 ETH in your testnet wallet

Run the deployment:

```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

**Expected Output**:
```
🚀 Deploying Eon Protocol Phase 1 to Arbitrum Sepolia...

Deploying from address: 0xYourAddress...
Account balance: X.XX ETH

1️⃣  Deploying MockERC20 (USDC)...
✅ Mock USDC deployed to: 0x...

2️⃣  Deploying MockLendingPool...
✅ MockLendingPool deployed to: 0x...

3️⃣  Deploying ReputationScorer...
✅ ReputationScorer deployed to: 0x...

4️⃣  Deploying DutchAuctionLiquidator...
✅ DutchAuctionLiquidator deployed to: 0x...

5️⃣  Deploying HealthFactorMonitor...
✅ HealthFactorMonitor deployed to: 0x...

6️⃣  Deploying InsuranceFund...
✅ InsuranceFund deployed to: 0x...

7️⃣  Setting up contract authorizations...
   ✓ LendingPool authorized in ReputationScorer
   ✓ Liquidator authorized in ReputationScorer
   ✓ HealthMonitor authorized in ReputationScorer
   ✓ LendingPool authorized in InsuranceFund

======================================================================
🎉 PHASE 1 DEPLOYMENT COMPLETE!
======================================================================
```

**Duration**: ~2-5 minutes

---

## ✅ Post-Deployment

### 1. Save Contract Addresses

Addresses automatically saved to `deployment-addresses.json`:

```json
{
  "network": "arbitrumSepolia",
  "deployedAt": "2025-10-02T...",
  "deployer": "0x...",
  "contracts": {
    "MockUSDC": "0x...",
    "MockLendingPool": "0x...",
    "ReputationScorer": "0x...",
    "DutchAuctionLiquidator": "0x...",
    "HealthFactorMonitor": "0x...",
    "InsuranceFund": "0x..."
  }
}
```

### 2. View on Arbiscan

Visit: `https://sepolia.arbiscan.io/address/CONTRACT_ADDRESS`

For each contract to:
- ✅ Verify deployment successful
- ✅ Check transaction history
- ✅ Interact with contract

### 3. Verify Contracts (Optional but Recommended)

Get Arbiscan API key: https://arbiscan.io/myapikey

Add to `.env`:
```
ARBISCAN_API_KEY=your_api_key_here
```

Run verification commands from deployment output:
```bash
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Benefits:
- Makes contracts readable on Arbiscan
- Users can interact via Arbiscan UI
- Increases transparency and trust

### 4. Test Deployment

```bash
# Open Hardhat console
npx hardhat console --network arbitrumSepolia

# Load contracts from deployment-addresses.json
const addresses = require('./deployment-addresses.json');

# Test USDC
const usdc = await ethers.getContractAt("MockERC20", addresses.contracts.MockUSDC);
console.log("USDC Name:", await usdc.name());

# Test ReputationScorer
const scorer = await ethers.getContractAt("ReputationScorer", addresses.contracts.ReputationScorer);
const [signer] = await ethers.getSigners();
await scorer.calculateScore(signer.address, 750);
const score = await scorer.scores(signer.address);
console.log("Credit Tier:", score.tier);
console.log("LTV:", score.ltv.toString() + "%");
```

---

## 🐛 Troubleshooting

### Error: "Cannot read properties of undefined (reading 'address')"

**Cause**: No private key configured

**Solution**:
1. Check `.env` file exists
2. Verify `PRIVATE_KEY=0x...` is set correctly
3. Restart terminal after editing `.env`

### Error: "Insufficient funds for gas"

**Cause**: Not enough testnet ETH

**Solution**:
1. Visit faucets (see step 2 above)
2. Request testnet ETH
3. Wait for transaction to confirm
4. Retry deployment

### Error: "Network unreachable" or "Connection timeout"

**Cause**: RPC endpoint issues

**Solution**:
1. Try alternative RPC in `.env`:
   ```
   ARBITRUM_SEPOLIA_RPC=https://arbitrum-sepolia.blockpi.network/v1/rpc/public
   ```
2. Check Arbitrum status: https://status.arbitrum.io/
3. Check internet connection

### Error: "Invalid private key"

**Cause**: Private key format incorrect

**Solution**:
1. Ensure private key starts with `0x`
2. Private key should be 64 characters (66 with `0x`)
3. No spaces or extra characters
4. Example: `PRIVATE_KEY=0x1234567890abcdef...`

---

## 📋 Quick Reference

### Get Testnet ETH
```
https://faucet.quicknode.com/arbitrum/sepolia
```

### Deploy Command
```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

### View on Arbiscan
```
https://sepolia.arbiscan.io/address/YOUR_CONTRACT_ADDRESS
```

### Hardhat Console
```bash
npx hardhat console --network arbitrumSepolia
```

---

## 📞 Need Help?

1. Check `.env` file has correct private key
2. Verify testnet ETH balance > 0.01 ETH
3. Review error messages carefully
4. Check Arbitrum Sepolia network status
5. Try alternative RPC endpoint

---

## 🎯 Success Criteria

Deployment successful when you see:
- ✅ All 6 contracts deployed
- ✅ All transactions confirmed
- ✅ Contract addresses displayed
- ✅ Authorizations configured
- ✅ Addresses saved to `deployment-addresses.json`

**Next Step**: Follow [TESTNET_TESTING_PLAN.md](./TESTNET_TESTING_PLAN.md) for comprehensive testing!

---

**Ready to deploy? Let's go! 🚀**
