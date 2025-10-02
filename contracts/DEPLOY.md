# 🚀 Eon Protocol Deployment Guide

**Deploy 6 contracts to Arbitrum Sepolia in ONE COMMAND**

## Prerequisites

1. **Testnet ETH on Arbitrum Sepolia**
   - Get free testnet ETH: https://faucet.quicknode.com/arbitrum/sepolia
   - Need ~0.05 ETH for deployment

2. **Private Key**
   - Export from MetaMask: Settings → Security & Privacy → Show Private Key
   - ⚠️ NEVER use mainnet key with funds

3. **Arbiscan API Key** (optional, for verification)
   - Create account: https://arbiscan.io/register
   - Get API key: https://arbiscan.io/myapikey

## Setup

```bash
# 1. Install dependencies
cd contracts
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your keys
nano .env
```

**.env file:**
```
PRIVATE_KEY=abc123...  # NO 0x prefix
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=YOUR_KEY_HERE
```

## Deploy to Arbitrum Sepolia

```bash
npm run deploy:sepolia
```

**Expected output:**
```
🚀 EON PROTOCOL DEPLOYMENT
==================================================
Network: arbitrumSepolia
Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Balance: 0.05 ETH

📝 Deploying ZKVerifierMock...
✅ ZKVerifierMock deployed: 0x1234...

📝 Deploying ChronosNFT...
✅ ChronosNFT deployed: 0x5678...

📝 Deploying ClaimManager...
✅ ClaimManager deployed: 0x9abc...

📝 Deploying LendingPool...
✅ LendingPool deployed: 0xdef0...

📝 Deploying ReputationOracle...
✅ ReputationOracle deployed: 0x1111...

🔧 Granting minter role to ClaimManager...
✅ Minter role granted

🔧 Initializing lending pools...
✅ Pools initialized

📁 Deployment addresses saved to: deployments-arbitrumSepolia.json

🎉 DEPLOYMENT COMPLETE
```

## Verify Contracts (Optional)

```bash
# Verify on Arbiscan
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS>
```

## What Gets Deployed

1. **ZKVerifierMock** - Mock ZK verifier (always returns true for testnet)
2. **ChronosNFT** - Soulbound reputation NFT (ERC-721)
3. **ChronosCore** - Base contract with economic parameters
4. **ClaimManager** - Temporal ownership claim system
5. **LendingPool** - Undercollateralized lending with 3 pools
6. **ReputationOracle** - Cross-chain reputation (LayerZero ready)

## Lending Pool Configuration

**Conservative Pool (Type 0):**
- LTV: 50-70%
- APR: 5-10%
- Risk: Low

**Balanced Pool (Type 1):**
- LTV: 60-80%
- APR: 7-12%
- Risk: Medium

**Aggressive Pool (Type 2):**
- LTV: 70-90%
- APR: 10-15%
- Risk: High

## Next Steps

1. **Update Indexer:**
   ```bash
   cd ../indexer
   cp .env.example .env
   # Add ClaimManager address from deployments-arbitrumSepolia.json
   ```

2. **Update Frontend:**
   ```bash
   cd ../frontend
   # Copy contract addresses to src/config/contracts.ts
   ```

3. **Test on Sepolia:**
   - Get testnet ETH
   - Submit a claim
   - Wait 7 days (or fast-forward in local testing)
   - Mint reputation NFT
   - Borrow from pool

## Troubleshooting

**Error: Insufficient funds**
→ Get more testnet ETH from faucet

**Error: Network not configured**
→ Check hardhat.config.js has arbitrumSepolia network

**Error: Private key not found**
→ Check .env file exists and has PRIVATE_KEY

**Error: Deployment failed**
→ Check contract compilation: `npm run compile`

## Gas Costs (Arbitrum Sepolia)

- ZKVerifierMock: ~0.001 ETH
- ChronosNFT: ~0.003 ETH
- ChronosCore: ~0.002 ETH
- ClaimManager: ~0.005 ETH
- LendingPool: ~0.004 ETH
- ReputationOracle: ~0.003 ETH
- **Total: ~0.018 ETH**

## Security Notes

⚠️ **TESTNET ONLY:**
- ZKVerifierMock accepts ALL proofs (no real ZK verification)
- No circuit breaker multisig
- No governance/DAO controls
- No proxy upgrade pattern

**For mainnet:**
- Replace ZKVerifierMock with real Groth16 verifier
- Add multisig for emergency controls
- Implement UUPS proxy pattern
- Get security audit ($30K+)
