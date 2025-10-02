# 🚀 SPRINT 1 DEPLOYMENT CHECKLIST

**Complete testnet launch in ~4 hours**

---

## ☐ STEP 1: Get Testnet ETH (5 minutes)

1. Get Arbitrum Sepolia testnet ETH
   - **Faucet:** https://faucet.quicknode.com/arbitrum/sepolia
   - **Amount needed:** 0.05 ETH (enough for deployment + testing)
   - **Wallet:** MetaMask or any Web3 wallet

✅ **Done when:** You have ≥0.05 ETH on Arbitrum Sepolia

---

## ☐ STEP 2: Deploy Smart Contracts (15 minutes)

```bash
cd /tmp/eon-protocol/contracts

# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env (add your private key)
nano .env
# PRIVATE_KEY=your_key_here_NO_0x_prefix
# ARBISCAN_API_KEY=optional_for_verification

# 4. Deploy to Arbitrum Sepolia
npm run deploy:sepolia
```

**Expected output:**
```
✅ ZKVerifierMock deployed: 0x1234...
✅ ChronosNFT deployed: 0x5678...
✅ ClaimManager deployed: 0x9abc...
✅ LendingPool deployed: 0xdef0...
✅ ReputationOracle deployed: 0x1111...

📁 Deployment addresses saved to: deployments-arbitrumSepolia.json
```

✅ **Done when:** `deployments-arbitrumSepolia.json` file exists

---

## ☐ STEP 3: Setup Supabase Database (10 minutes)

1. **Create project**
   - Go to https://supabase.com
   - Click "New Project"
   - Name: `eon-protocol`
   - Region: Choose closest
   - Wait 2 mins

2. **Run schema**
   - Open SQL Editor in Supabase
   - Copy contents of `/database/schema.sql`
   - Paste and click "Run"
   - Should see "Success. No rows returned."

3. **Get credentials**
   - Settings → Database → Connection string (URI)
   - Settings → API → service_role key
   - Save both for next step

✅ **Done when:** `SELECT * FROM protocol_stats;` returns 0s

---

## ☐ STEP 4: Deploy Indexer to Railway (15 minutes)

1. **Create Railway account**
   - Go to https://railway.app
   - Sign up with GitHub
   - Free tier: 500 hours/month

2. **Connect repo**
   - New Project → Deploy from GitHub
   - Select `eon-protocol` repo
   - Root directory: `/indexer`

3. **Add environment variables** (in Railway dashboard)
   ```
   DATABASE_URL=postgresql://[from-supabase]
   ALCHEMY_API_KEY=[get-from-alchemy.com]
   RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
   WS_RPC_URL=wss://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
   CLAIM_MANAGER_ADDRESS=[from-deployments.json]
   START_BLOCK=0
   ```

4. **Deploy**
   - Railway auto-deploys on git push
   - Check logs for "✅ Scanner running"

**Get Alchemy API Key:**
- https://www.alchemy.com → Create app → Copy API key

✅ **Done when:** Railway logs show "✅ Scanner running from block 0"

---

## ☐ STEP 5: Deploy Frontend to Vercel (10 minutes)

```bash
cd /tmp/eon-protocol/frontend

# 1. Create .env.local
cp .env.example .env.local

# 2. Edit .env.local
nano .env.local
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=[from cloud.walletconnect.com]
# NEXT_PUBLIC_SUPABASE_URL=[from supabase]
# NEXT_PUBLIC_SUPABASE_ANON_KEY=[from supabase]

# 3. Update contract addresses
nano app/contracts.ts
# Replace 0x000... with addresses from deployments-arbitrumSepolia.json

# 4. Install Vercel CLI
npm install -g vercel

# 5. Deploy
vercel --prod
```

**Get WalletConnect Project ID:**
- https://cloud.walletconnect.com → New Project → Copy ID

✅ **Done when:** Vercel gives you URL like `https://eon-protocol.vercel.app`

---

## ☐ STEP 6: Test Everything (20 minutes)

### Test Contract Deployment
```bash
cd /tmp/eon-protocol/contracts
npx hardhat verify --network arbitrumSepolia [CLAIM_MANAGER_ADDRESS]
```
- Should see "Successfully verified" on Arbiscan

### Test Database
- Go to Supabase → Table Editor
- Should see empty tables: `claims`, `reputation`, `loans`

### Test Indexer
- Check Railway logs
- Should see "Syncing blocks..." messages

### Test Frontend
1. Visit your Vercel URL
2. Connect wallet (MetaMask)
3. Switch to Arbitrum Sepolia
4. Go to `/claim` page
5. Submit a test claim
6. Check Railway logs → Should see "New claim detected"
7. Check Supabase → Should see new row in `claims` table

✅ **Done when:** Full flow works: Submit claim → Indexer detects → Database updates

---

## ☐ STEP 7: Launch Announcement (30 minutes)

### Setup Socials
1. **Domain** (optional, $12/year)
   - Buy `eonprotocol.xyz` on Namecheap
   - Point to Vercel in domain settings

2. **Twitter**
   - Create @eonprotocol account
   - Bio: "Undercollateralized lending powered by time. Prove your on-chain history, earn reputation, borrow more."

3. **Discord** (free)
   - Create server
   - Channels: #general, #testing, #support
   - Invite link in Twitter bio

### Launch Tweet
```
🚀 EON PROTOCOL IS LIVE (Testnet)

Undercollateralized lending powered by on-chain reputation.

Prove you held ETH for X months → Earn credit score → Borrow more

✅ Live on Arbitrum Sepolia
✅ 3-page dApp ready
✅ First temporal reputation protocol

Try it: [your-vercel-url]

[Thread 1/5]
```

**Thread structure:**
1. Hook + link
2. How it works (3 steps)
3. Why it matters (vs overcollateralized)
4. Tech (temporal proofs, ZK-ready)
5. Call to action + Discord invite

### Post in Communities
- r/ethdev
- r/ethereum
- Crypto Twitter (#DeFi, #Web3)
- DeFi Discord servers

✅ **Done when:** Tweet posted + 50+ people in Discord

---

## ☐ STEP 8: Get First 10 Testers (2-4 hours)

### Finding Testers
1. DM 20 crypto friends on Twitter
2. Post in DeFi Discords
3. Offer "OG NFT" to first 10 testers

### Tester Guide
```
TESTER INSTRUCTIONS:

1. Get testnet ETH: https://faucet.quicknode.com/arbitrum/sepolia
2. Visit: [your-url]
3. Connect wallet (switch to Arbitrum Sepolia)
4. Go to /claim
5. Submit claim: 10 ETH for 365 days
6. Wait 1 min → Check /profile
7. Report bugs in Discord #testing

Reward: Early supporter NFT when we launch mainnet
```

### Success Metrics
- ✅ 10 unique wallets submit claims
- ✅ All claims detected by indexer
- ✅ All claims written to Supabase
- ✅ 0 critical bugs

✅ **Done when:** 10 successful test claims + feedback collected

---

## 🎉 SPRINT 1 COMPLETE

**You now have:**
- ✅ Live testnet contracts on Arbitrum Sepolia
- ✅ Working frontend (3 pages)
- ✅ Running indexer (scanning blockchain)
- ✅ Database with credit profiles
- ✅ 10+ real testers
- ✅ Community (Discord + Twitter)

**Total time:** ~4 hours
**Total cost:** $0-12 (optional domain)

---

## 🚨 Common Issues & Fixes

**"Deployment failed - insufficient funds"**
→ Get more testnet ETH from faucet

**"Indexer not detecting claims"**
→ Check Railway env vars, especially CLAIM_MANAGER_ADDRESS

**"Frontend shows wrong chain"**
→ Switch MetaMask to Arbitrum Sepolia

**"Supabase connection failed"**
→ Check DATABASE_URL has correct password

**"Vercel build failed"**
→ Check .env.local has all required vars

---

## 📊 Post-Sprint 1 Metrics

Track these in Discord:
- Total claims submitted
- Average reputation score
- Challenges (should be 0 on testnet)
- Bug reports
- Feature requests

**Next:** Sprint 2 (fix exploits + add score decay)
