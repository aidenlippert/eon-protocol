# 🚀 Eon Protocol Deployment Guide

**Status**: ✅ Ready for Testnet Deployment
**Network**: Arbitrum Sepolia
**Date**: October 2, 2025

---

## 📋 Pre-Deployment Checklist

- ✅ All contracts compiled successfully
- ✅ 150/150 tests passing (100% pass rate)
- ✅ All user journeys tested end-to-end
- ✅ Security controls in place
- ✅ Deployment script tested locally
- ⏳ **Testnet ETH required** (get from faucet)
- ⏳ **Private key required** (create wallet)

---

## 🔧 Setup Instructions

### 1. Get Testnet ETH

Get Arbitrum Sepolia testnet ETH from:
- **QuickNode Faucet**: https://faucet.quicknode.com/arbitrum/sepolia
- **Alchemy Faucet**: https://sepoliafaucet.com/
- **Chainlink Faucet**: https://faucets.chain.link/arbitrum-sepolia

**Amount needed**: ~0.05 ETH (for deployment + testing)

### 2. Create/Configure Wallet

If you don't have a testnet wallet yet:

```bash
# Option 1: Use Hardhat's test accounts (NOT FOR MAINNET!)
# Already configured in hardhat.config.ts

# Option 2: Create new wallet with private key
# Get private key from MetaMask or generate new wallet
```

### 3. Setup Environment Variables

Create `.env` file in project root:

```bash
# Required for deployment
PRIVATE_KEY=your_private_key_here

# Optional (uses default if not set)
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc

# Optional (for contract verification)
ARBISCAN_API_KEY=your_arbiscan_api_key_here
```

**⚠️ SECURITY WARNING**: Never commit `.env` file or share your private key!

---

## 🚀 Deployment Steps

### Step 1: Deploy to Arbitrum Sepolia

```bash
# Make sure you're in the project directory
cd /tmp/eon-protocol

# Deploy all contracts
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

**Expected Output**:
```
🚀 Deploying Eon Protocol Phase 1 to Arbitrum Sepolia...
Deploying from address: 0x...
Account balance: X.XX ETH

1️⃣  Deploying MockERC20 (USDC)...
✅ Mock USDC deployed to: 0x...

2️⃣  Deploying MockLendingPool...
✅ MockLendingPool deployed to: 0x...

[... etc ...]

🎉 PHASE 1 DEPLOYMENT COMPLETE!
```

**Duration**: ~2-5 minutes

### Step 2: Save Deployment Addresses

Deployment addresses are automatically saved to `deployment-addresses.json`.

**Example**:
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

### Step 3: Verify Contracts on Arbiscan

Get Arbiscan API key from: https://arbiscan.io/myapikey

```bash
# Copy verification commands from deployment output
# Example:
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

**Why verify?**
- Makes contracts readable on Arbiscan
- Users can interact directly via Arbiscan UI
- Increases trust and transparency

---

## 🧪 Post-Deployment Testing

### Test 1: Verify Deployment

```bash
# Start Hardhat console
npx hardhat console --network arbitrumSepolia

# Load contracts
const usdc = await ethers.getContractAt("MockERC20", "USDC_ADDRESS");
const scorer = await ethers.getContractAt("ReputationScorer", "SCORER_ADDRESS");
const lendingPool = await ethers.getContractAt("MockLendingPool", "POOL_ADDRESS");

# Check deployment
console.log("USDC name:", await usdc.name());
console.log("Scorer owner:", await scorer.owner());
```

### Test 2: Mint Test USDC

```bash
# In Hardhat console
const [deployer] = await ethers.getSigners();
await usdc.mint(deployer.address, ethers.parseEther("100000"));
console.log("Balance:", ethers.formatEther(await usdc.balanceOf(deployer.address)));
```

### Test 3: Calculate Credit Score

```bash
# In Hardhat console
await scorer.calculateScore(deployer.address, 750); // Gold tier
const score = await scorer.scores(deployer.address);
console.log("Total Score:", score.totalScore.toString());
console.log("Tier:", score.tier);
console.log("LTV:", score.ltv.toString() + "%");
```

### Test 4: Run Full Test Plan

Follow the comprehensive test scenarios in `TESTNET_TESTING_PLAN.md`:
1. New user loan cycle
2. Liquidation flow
3. Insurance coverage
4. Multi-user scenarios
5. Edge cases
6. Stress testing

---

## 📊 Monitoring & Verification

### View Transactions on Arbiscan

```
https://sepolia.arbiscan.io/address/<CONTRACT_ADDRESS>
```

### Check Contract State

```bash
# Hardhat console
npx hardhat console --network arbitrumSepolia

# Check authorizations
const scorer = await ethers.getContractAt("ReputationScorer", "SCORER_ADDRESS");
console.log("LendingPool authorized:", await scorer.authorizedUpdaters("POOL_ADDRESS"));
```

---

## 🔍 Troubleshooting

### Issue: "Insufficient funds for gas"

**Solution**: Get more testnet ETH from faucets (see Setup step 1)

### Issue: "Invalid private key"

**Solution**:
1. Check `.env` file has correct format
2. Ensure private key starts with `0x`
3. Verify private key is from your testnet wallet

### Issue: "Network unreachable"

**Solution**:
1. Check internet connection
2. Try alternative RPC: `https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY`
3. Verify Arbitrum Sepolia is operational: https://status.arbitrum.io/

### Issue: "Contract verification failed"

**Solution**:
1. Wait 1-2 minutes after deployment
2. Check constructor args match deployment
3. Ensure compiler version matches (0.8.20)
4. Verify Arbiscan API key is correct

---

## 📝 Next Steps After Deployment

### Immediate (Day 1)
- ✅ Deploy contracts to testnet
- ✅ Verify all contracts on Arbiscan
- ✅ Run basic smoke tests
- ✅ Share contract addresses with team

### Short-term (Week 1)
- 🧪 Complete full testnet testing plan
- 📊 Monitor gas usage and optimize
- 🐛 Fix any issues found in testing
- 📄 Update documentation with testnet addresses

### Medium-term (Week 2-4)
- 🔒 Security audit (internal review)
- 👥 Invite beta testers
- 📈 Stress test with multiple users
- 🔄 Iterate based on feedback

### Long-term (Month 2+)
- 🔐 Professional security audit
- 🚀 Deploy to Arbitrum mainnet
- 🌐 Launch frontend interface
- 📢 Public announcement

---

## 🎯 Success Criteria

### Deployment Successful If:
- ✅ All 6 contracts deployed
- ✅ All transactions confirmed
- ✅ All contracts verified on Arbiscan
- ✅ All authorizations set correctly
- ✅ Basic tests passing on testnet

### Ready for Mainnet If:
- ✅ 100% test coverage maintained
- ✅ All testnet scenarios successful
- ✅ No critical bugs found
- ✅ Security audit completed
- ✅ Gas optimization completed
- ✅ Documentation finalized

---

## 📞 Support

### Resources
- **Hardhat Docs**: https://hardhat.org/docs
- **Arbitrum Docs**: https://docs.arbitrum.io/
- **Ethers.js Docs**: https://docs.ethers.org/

### Community
- **Arbitrum Discord**: https://discord.gg/arbitrum
- **Hardhat Discord**: https://hardhat.org/discord

---

## 🎉 Deployment Complete!

Once deployed, your contracts will be live on Arbitrum Sepolia testnet!

**Next**: Run the comprehensive testing plan (`TESTNET_TESTING_PLAN.md`)

**View on Arbiscan**: https://sepolia.arbiscan.io/address/<YOUR_CONTRACT>

---

**Good luck with your deployment! 🚀**
