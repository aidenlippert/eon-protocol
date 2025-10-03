# 🚀 Deploy Eon Protocol to Arbitrum Sepolia NOW

You have **0.0094 ETH** on Arbitrum Sepolia - enough to deploy!

---

## Quick Deploy (3 steps)

### Step 1: Add Your Private Key

```bash
cd /tmp/eon-protocol

# Edit .env file
nano .env
```

Add your private key:
```env
PRIVATE_KEY=0xYOUR_ARBITRUM_SEPOLIA_PRIVATE_KEY_HERE
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
```

**How to get your private key**:
1. Open MetaMask
2. Click 3 dots (top right) → Account Details
3. Click "Export Private Key"
4. Enter your password
5. Copy the private key (starts with 0x)

⚠️ **IMPORTANT**: This should be your **testnet wallet only**, NOT your mainnet wallet!

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

---

### Step 2: Deploy

```bash
npx hardhat run scripts/deploy-testnet.ts --network arbitrumSepolia
```

This will:
- Deploy CreditRegistryV1_1
- Deploy LendingPoolV1
- Deploy ReputationScorer
- Deploy HealthFactorMonitor
- Deploy InsuranceFund
- Configure attester
- Save all addresses to JSON

**Expected runtime**: 2-3 minutes

**Gas cost**: ~0.005 ETH (~$23 if this were mainnet, but it's free testnet!)

---

### Step 3: Verify Contracts (Optional)

After deployment completes, it will show verification commands like:

```bash
npx hardhat verify --network arbitrumSepolia \
  0xCONTRACT_ADDRESS \
  CONSTRUCTOR_ARGS
```

Copy and run each command to verify contracts on Arbiscan.

---

## Expected Output

```
🚀 Starting Eon Protocol v1 Testnet Deployment...

📍 Network: arbitrumSepolia (ChainID: 421614)
👤 Deployer: 0xYourAddress...
💰 Balance: 0.0094 ETH

⚙️  Configuration:
   Treasury: 0xYourAddress...
   Attester: 0xYourAddress...

📝 [1/7] Deploying CreditRegistryV1_1...
   ✅ CreditRegistryV1_1: 0x1234567890abcdef...

📝 [2/7] Deploying LendingPoolV1...
   ✅ LendingPoolV1: 0xabcdef1234567890...

📝 [3/7] Deploying ReputationScorer...
   ✅ ReputationScorer: 0x7890abcdef123456...

📝 [4/7] Deploying Mock Price Oracle...
   ✅ MockPriceOracle: 0x4567890abcdef123...

📝 [5/7] Deploying HealthFactorMonitor...
   ✅ HealthFactorMonitor: 0xdef1234567890abc...

📝 [6/7] Deploying Mock USDC...
   ✅ MockUSDC: 0x567890abcdef1234...

📝 [7/7] Deploying InsuranceFund...
   ✅ InsuranceFund: 0x890abcdef1234567...

⚙️  Post-Deployment Configuration...
   [1/1] Setting authorized attester...
   ✅ Attester authorized

💾 Deployment info saved: deployments/arbitrumSepolia-1234567890.json

✅ Deployment Complete!

📋 Contract Addresses:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CreditRegistryV1_1:     0x1234...
   LendingPoolV1:          0xabcd...
   HealthFactorMonitor:    0x7890...
   InsuranceFund:          0xdef1...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## After Deployment

### View on Arbiscan

All contracts will be visible at:
`https://sepolia.arbiscan.io/address/0xYOUR_CONTRACT_ADDRESS`

### Deployment Addresses

Saved to: `/tmp/eon-protocol/deployments/arbitrumSepolia-TIMESTAMP.json`

```json
{
  "creditRegistry": "0x...",
  "lendingPool": "0x...",
  "healthFactorMonitor": "0x...",
  "insuranceFund": "0x...",
  "treasury": "0xYourAddress",
  "attester": "0xYourAddress",
  "deployer": "0xYourAddress",
  "network": "arbitrumSepolia",
  "timestamp": 1234567890
}
```

---

## Troubleshooting

### "Insufficient funds for gas"
- You need at least 0.005 ETH
- Get more from: https://faucet.quicknode.com/arbitrum/sepolia

### "Invalid private key"
- Make sure it starts with 0x
- Make sure it's from your Arbitrum Sepolia account
- Try exporting again from MetaMask

### "Network connection failed"
- Check internet connection
- Try again (RPC might be temporarily down)

### "Contract already deployed at address"
- This is fine! The deployment succeeded
- Check the output for contract addresses

---

## Security Reminders

✅ **DO**:
- Use testnet wallet for testnet deployments
- Keep your mainnet and testnet wallets separate
- Save deployment addresses

❌ **DON'T**:
- Use your mainnet private key for testnet
- Share your private key (even testnet)
- Commit .env to git (it's gitignored)

---

## What You're Deploying

**7 Smart Contracts** (2,200+ lines of code):

1. **CreditRegistryV1_1** - Optimistic oracle for credit scores
2. **LendingPoolV1** - Dynamic interest lending pool
3. **ReputationScorer** - Multi-factor scoring system
4. **HealthFactorMonitor** - Liquidation monitoring
5. **InsuranceFund** - Protocol safety net
6. **MockPriceOracle** - Chainlink-compatible price feeds
7. **MockUSDC** - Test stablecoin

**Test Coverage**: 137/159 tests passing (86%)

---

## Ready to Deploy?

```bash
cd /tmp/eon-protocol
nano .env  # Add your private key
npx hardhat run scripts/deploy-testnet.ts --network arbitrumSepolia
```

**Good luck!** 🚀

---

## Need Help?

If anything goes wrong, you can:
1. Check the error message
2. Look at DEPLOYMENT.md for detailed troubleshooting
3. Try deploying to local Hardhat first: `npx hardhat run scripts/deploy-testnet.ts --network hardhat`
