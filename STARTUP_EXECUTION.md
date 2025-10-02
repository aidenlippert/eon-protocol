# 🚀 EON PROTOCOL - ZERO TO MAINNET STARTUP EXECUTION

**Complete build plan from garage → $10M protocol**

---

# 📅 SPRINT 1 (Week 1-2): TESTNET MVP LAUNCH

**Goal:** Live testnet demo with working frontend + 10 testers

## Day 1-2: Smart Contracts (THIS WEEKEND)

### Deploy to Arbitrum Sepolia
```bash
cd contracts
cp .env.example .env
# Add PRIVATE_KEY (get testnet ETH from faucet)
npm install
npm run deploy:sepolia
```

**Deliverables:**
- ✅ 6 contracts deployed
- ✅ Addresses saved to deployments-arbitrumSepolia.json
- ✅ Verified on Arbiscan

**Cost:** $0 (testnet ETH free)
**Time:** 30 minutes

---

## Day 3: Database Setup (MONDAY)

### Supabase PostgreSQL (FREE)

**Sign up:** https://supabase.com → New Project

**Create tables:**
```sql
-- Claims table
CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  min_balance TEXT NOT NULL,
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  merkle_root TEXT NOT NULL,
  stake TEXT NOT NULL,
  status TEXT NOT NULL,
  validated BOOLEAN,
  validation_result BOOLEAN,
  reputation_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reputation table
CREATE TABLE reputation (
  user_address TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  age_months INTEGER NOT NULL,
  last_claim_id TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Loans table
CREATE TABLE loans (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  pool_type INTEGER NOT NULL,
  collateral_amount TEXT NOT NULL,
  borrow_amount TEXT NOT NULL,
  ltv INTEGER NOT NULL,
  apr INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_claims_user ON claims(user_address);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_reputation_score ON reputation(score DESC);
CREATE INDEX idx_loans_user ON loans(user_address);
CREATE INDEX idx_loans_status ON loans(status);
```

**Deliverables:**
- ✅ Supabase project created
- ✅ Tables + indexes created
- ✅ Connection URL copied

**Cost:** $0 (free tier)
**Time:** 15 minutes

---

## Day 4-5: Deploy Indexer (TUESDAY-WEDNESDAY)

### Railway.app Deployment (FREE)

**Setup:**
1. Go to https://railway.app
2. Connect GitHub repo
3. Deploy `/indexer` folder
4. Add environment variables

**Environment Variables:**
```
DATABASE_URL=postgresql://[supabase-url]
ALCHEMY_API_KEY=your_key_here
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
WS_RPC_URL=wss://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
CLAIM_MANAGER_ADDRESS=[from deployments.json]
START_BLOCK=0
```

**Update indexer code:**
```bash
cd indexer
npm install
# Test locally first
npm run dev
```

**Deliverables:**
- ✅ Indexer running on Railway
- ✅ Scanning blockchain events
- ✅ Writing to Supabase
- ✅ Credit scoring working

**Cost:** $0 (Railway free tier: 500 hours/month)
**Time:** 2 hours

---

## Day 6-10: Build Frontend (THURSDAY-MONDAY)

### Next.js Barebones dApp

**Create project:**
```bash
npx create-next-app@latest eon-frontend --typescript --tailwind --app
cd eon-frontend
npm install wagmi viem @rainbow-me/rainbowkit
```

**3 Pages:**

### 1. Home Page (`app/page.tsx`)
```typescript
export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-6xl font-bold mb-4">EON PROTOCOL</h1>
        <p className="text-2xl text-gray-400 mb-8">
          Undercollateralized Lending, Powered by Time
        </p>

        <ConnectButton />

        <div className="mt-12 grid grid-cols-3 gap-8">
          <div className="border border-gray-700 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2">1. Prove Holdings</h3>
            <p className="text-gray-400">
              Prove you held ETH for X months
            </p>
          </div>
          <div className="border border-gray-700 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2">2. Get Reputation</h3>
            <p className="text-gray-400">
              Earn 0-1000 credit score
            </p>
          </div>
          <div className="border border-gray-700 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-2">3. Borrow More</h3>
            <p className="text-gray-400">
              Up to 90% LTV loans
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

### 2. Claim Page (`app/claim/page.tsx`)
```typescript
'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { parseEther } from 'viem';

export default function Claim() {
  const [balance, setBalance] = useState('10');
  const [duration, setDuration] = useState('365');

  const { writeContract } = useWriteContract();

  const estimatedScore = calculateScore(balance, duration);
  const estimatedLTV = calculateLTV(estimatedScore);

  const handleSubmit = async () => {
    // Get current block - duration
    const startBlock = currentBlock - (parseInt(duration) * 6500);
    const endBlock = currentBlock;

    writeContract({
      address: CLAIM_MANAGER_ADDRESS,
      abi: ClaimManagerABI,
      functionName: 'submitClaim',
      args: [parseEther(balance), startBlock, endBlock, merkleRoot],
      value: parseEther('0.1') // Stake
    });
  };

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Prove Your Holdings</h1>

        <div className="space-y-6">
          <div>
            <label className="block mb-2">I held</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 p-4 rounded-lg"
              placeholder="10"
            />
            <span className="text-gray-400 ml-2">ETH</span>
          </div>

          <div>
            <label className="block mb-2">For</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 p-4 rounded-lg"
              placeholder="365"
            />
            <span className="text-gray-400 ml-2">days</span>
          </div>

          <div className="border border-gray-700 p-6 rounded-lg bg-gray-900">
            <p className="text-sm text-gray-400 mb-2">Estimated Reputation</p>
            <p className="text-3xl font-bold">{estimatedScore}/1000</p>
            <p className="text-sm text-gray-400 mt-4">Estimated LTV</p>
            <p className="text-3xl font-bold">{estimatedLTV}%</p>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-gray-200"
          >
            Submit Claim (0.1 ETH stake)
          </button>
        </div>
      </div>
    </main>
  );
}
```

### 3. Profile Page (`app/profile/page.tsx`)
```typescript
'use client';

import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

export default function Profile() {
  const { address } = useAccount();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (address) {
      // Fetch from Supabase
      fetch(`/api/credit-profile/${address}`)
        .then(r => r.json())
        .then(setProfile);
    }
  }, [address]);

  if (!profile) return <div>Loading...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Your Reputation</h1>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <div className="border border-gray-700 p-8 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Credit Score</p>
            <p className="text-5xl font-bold">{profile.score}/1000</p>
          </div>
          <div className="border border-gray-700 p-8 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Your LTV</p>
            <p className="text-5xl font-bold">{profile.ltv}%</p>
          </div>
          <div className="border border-gray-700 p-8 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Available Credit</p>
            <p className="text-3xl font-bold">
              {formatEther(profile.availableCredit)} ETH
            </p>
          </div>
          <div className="border border-gray-700 p-8 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Risk Tier</p>
            <p className="text-5xl font-bold">{profile.riskTier}</p>
          </div>
        </div>

        <button className="w-full bg-white text-black font-bold py-4 rounded-lg text-xl">
          Borrow ETH →
        </button>

        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Active Claims</h2>
          {profile.claims.map(claim => (
            <div key={claim.id} className="border border-gray-700 p-4 rounded-lg mb-4">
              <div className="flex justify-between">
                <span>{claim.minBalance} ETH for {claim.duration} days</span>
                <span className="text-yellow-500">{claim.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Deploy to Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Deliverables:**
- ✅ 3-page working dApp
- ✅ Wallet connection (RainbowKit)
- ✅ Claim submission
- ✅ Credit score display
- ✅ Live on Vercel

**Cost:** $0 (Vercel free tier)
**Time:** 8 hours (or hire dev on Upwork for $500)

---

## Day 11-14: Launch & Test (WEEK 2)

### Branding
- Logo from Fiverr: $50
- Domain eonprotocol.xyz: $12
- Twitter @eonprotocol

### Community Setup
- Discord server (free)
- Twitter thread launch
- Post in r/ethdev, Crypto Twitter

### Alpha Testing
- Invite 10 testers from Twitter
- Give them testnet ETH
- Watch them use the app
- Fix bugs in real-time

**Deliverables:**
- ✅ Live testnet with 10+ users
- ✅ Discord with 50+ members
- ✅ Twitter thread with 1K+ views

**Cost:** $100 (logo + domain)
**Time:** Ongoing

---

# 📊 SPRINT 1 BUDGET & TIMELINE

**Total Cost:** $100
**Total Time:** 14 days
**Team Size:** 1 (you) or 1 + dev ($500)

**End State:**
- Live testnet on Arbitrum Sepolia
- Working frontend (eonprotocol.xyz)
- Real users testing
- 50+ Discord members
- Ready for Sprint 2

---

# 🛠 SPRINT 2 (Week 3-4): SECURITY & EXPLOITS

**Goal:** Patch critical flaws, prepare for public testing

## Week 3: Contract Fixes

### Fix 1: Claim Invalidation
```solidity
// ClaimManager.sol
mapping(address => uint256) public userActiveClaimId;

function submitClaim(...) external {
    uint256 oldClaimId = userActiveClaimId[msg.sender];
    if (oldClaimId != 0) {
        claims[oldClaimId].status = ClaimStatus.Invalidated;
    }

    userActiveClaimId[msg.sender] = claimId;
}
```

### Fix 2: Minimum Balance Threshold
```solidity
uint256 public constant MIN_CLAIMABLE_BALANCE = 1 ether;

function submitClaim(uint256 minBalance, ...) external {
    require(minBalance >= MIN_CLAIMABLE_BALANCE, "Balance too low");
}
```

### Fix 3: Score Decay
```solidity
// ChronosNFT.sol
struct Reputation {
    uint256 score;
    uint256 lastUpdateTime;
}

function getDecayedScore(uint256 tokenId) public view returns (uint256) {
    Reputation memory rep = reputations[tokenId];
    uint256 monthsElapsed = (block.timestamp - rep.lastUpdateTime) / 30 days;
    uint256 decay = monthsElapsed * 10; // -10 pts/month

    return rep.score > decay ? rep.score - decay : 0;
}
```

### Fix 4: Minimum Duration
```solidity
uint256 public constant MIN_CLAIM_DURATION = 180 days * 6500; // 6 months in blocks

function submitClaim(...) external {
    uint256 duration = endBlock - startBlock;
    require(duration >= MIN_CLAIM_DURATION, "Duration too short");
}
```

**Redeploy contracts to Sepolia v2**

---

## Week 4: Economic Hardening

### Implement Insurance Fund
```solidity
// LendingPool.sol
uint256 public constant ORIGINATION_FEE = 200; // 2%

function borrow(...) external {
    uint256 fee = (amount * ORIGINATION_FEE) / 10000;
    insuranceFund += fee;
}

function coverBadDebt(uint256 loanId) external onlyOwner {
    // Pay lenders from insurance fund
}
```

### Multi-Provider Archive Nodes
```typescript
// indexer/src/validator.ts
const providers = [
  new ethers.JsonRpcProvider(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  new ethers.JsonRpcProvider(`https://arbitrum-mainnet.infura.io/v3/${INFURA_KEY}`),
  new ethers.JsonRpcProvider(`https://arb1.arbitrum.io/rpc`)
];

async function queryWithFallback(block: number) {
  for (const provider of providers) {
    try {
      return await provider.getBalance(address, block);
    } catch (e) {
      continue; // Try next provider
    }
  }
  throw new Error('All providers failed');
}
```

### Exploit Contest
- Tweet: "$100 bounty for economic exploits"
- Run for 2 weeks
- Document all findings
- Fix critical issues

**Deliverables:**
- ✅ Contracts v2 with 4 critical fixes
- ✅ Insurance fund implemented
- ✅ Multi-provider fallback
- ✅ Exploit contest results

**Cost:** $100 (bounty)
**Time:** 14 days

---

# ⚡ SPRINT 3 (Week 5-6): ZK PROOFS & CROSS-CHAIN

**Goal:** Add real ZK verification, expand to Base

## Week 5: ZK Circuits

### Circom Circuit
```circom
// circuits/temporal_proof.circom
pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template TemporalProof(numSamples) {
    signal input balances[numSamples];
    signal input minBalance;
    signal input merkleRoot;

    signal output valid;

    component greaterEq[numSamples];
    for (var i = 0; i < numSamples; i++) {
        greaterEq[i] = GreaterEqThan(252);
        greaterEq[i].in[0] <== balances[i];
        greaterEq[i].in[1] <== minBalance;
    }

    // All samples must be >= minBalance
    component allValid = MultiAND(numSamples);
    for (var i = 0; i < numSamples; i++) {
        allValid.in[i] <== greaterEq[i].out;
    }

    valid <== allValid.out;
}

component main = TemporalProof(52);
```

### Generate Verifier Contract
```bash
circom temporal_proof.circom --r1cs --wasm --sym
snarkjs groth16 setup temporal_proof.r1cs pot12_final.ptau temporal_proof_0000.zkey
snarkjs zkey export solidityverifier temporal_proof.zkey Groth16Verifier.sol
```

### Deploy Real Verifier
Replace ZKVerifierMock with Groth16Verifier.sol

---

## Week 6: Cross-Chain (Base)

### Deploy to Base Sepolia
```bash
npm run deploy:base-sepolia
```

### LayerZero Integration
```solidity
// ReputationOracle.sol
function sendReputationCrossChain(
    address user,
    uint32 dstChainId
) external payable {
    bytes memory payload = abi.encode(user, getScore(user));

    endpoint.send{value: msg.value}(
        dstChainId,
        trustedRemote,
        payload,
        payable(msg.sender),
        address(0),
        bytes("")
    );
}
```

**Deliverables:**
- ✅ Real ZK proofs working
- ✅ Deployed on Base Sepolia
- ✅ Cross-chain reputation sync
- ✅ Prover service running

**Cost:** $200 (VPS for prover)
**Time:** 14 days

---

# 🌍 SPRINT 4 (Week 7-8): ECONOMIC RESILIENCE

**Goal:** Stress-test economics, simulate bad debt

## Week 7: Monte Carlo v2

### Updated Economic Model
```python
# monte_carlo_v2.py
import numpy as np

def simulate_with_decay(num_simulations=10000):
    results = []

    for i in range(num_simulations):
        # User claims score
        initial_score = np.random.randint(500, 1000)

        # Decay over 6 months
        months_elapsed = 6
        decay = months_elapsed * 10
        current_score = max(0, initial_score - decay)

        # Borrow at initial LTV, default at current LTV
        initial_ltv = calculate_ltv(initial_score)
        current_ltv = calculate_ltv(current_score)

        # Bad debt = difference
        bad_debt = (initial_ltv - current_ltv) * collateral

        results.append(bad_debt)

    return np.mean(results), np.percentile(results, 95)

avg_bad_debt, p95_bad_debt = simulate_with_decay()
print(f"Average bad debt: ${avg_bad_debt}")
print(f"95th percentile: ${p95_bad_debt}")

# Check if insurance fund covers it
insurance_coverage = total_fees * 0.75  # 75% of origination fees
coverage_ratio = insurance_coverage / p95_bad_debt
print(f"Coverage ratio: {coverage_ratio:.2f}x")
```

### Tune Parameters
Based on simulation results:
- Adjust decay rate
- Adjust origination fee
- Adjust LTV caps

---

## Week 8: Challenger Network

### Open-Source Indexer Docs
```markdown
# Running an Eon Indexer

## Requirements
- Archive node access (Alchemy/Infura)
- PostgreSQL database
- VPS ($5/month)

## Setup
git clone https://github.com/eon-protocol/indexer
cd indexer
cp .env.example .env
# Add your keys
npm install
npm start

## Economics
- Challenge reward: 0.1 ETH per successful challenge
- Expected monthly revenue: $1,500
- Operating costs: $20/month
- Net profit: $1,480/month
```

### Challenge Leaderboard
Build public leaderboard on frontend showing top challengers

**Deliverables:**
- ✅ Economic model v2 validated
- ✅ Parameters tuned for <5% bad debt
- ✅ Open-source indexer docs
- ✅ Challenge leaderboard live

**Cost:** $0
**Time:** 14 days

---

# 🚀 SPRINT 5 (Week 9-10): MAINNET BETA

**Goal:** First real-money users on Arbitrum One

## Week 9: Mainnet Deployment

### Security Checklist
- [ ] Replace ZKVerifierMock with real Groth16
- [ ] Add multisig circuit breaker (Gnosis Safe)
- [ ] Implement UUPS proxy pattern
- [ ] Deploy to Arbitrum One with low TVL caps
- [ ] Get code audit ($30K+ or skip for beta)

### Deploy to Mainnet
```bash
npm run deploy:mainnet
```

**Initial Parameters:**
- Max TVL per pool: $100K (prevents catastrophic loss)
- Circuit breaker: $10K/hour spike limit
- Multisig: 3/5 (you + 4 trusted advisors)

---

## Week 10: Beta Launch

### Seed Liquidity
- Deposit $10K of own funds across 3 pools
- Invite 5 friends to deposit $2K each
- Total: $20K initial liquidity

### Invite-Only Beta
- 50 beta testers (Twitter DMs)
- Max borrow: $1K per user
- Close monitoring

### Launch Announcement
- Blog post: "Eon Protocol Beta Live"
- Twitter thread
- Post in DeFi discords

**Deliverables:**
- ✅ Live on Arbitrum One mainnet
- ✅ $20K seed liquidity
- ✅ 50 beta users
- ✅ First real borrows

**Cost:** $30K (security audit) or $0 (skip audit, high risk)
**Time:** 14 days
**Capital at Risk:** $10K

---

# 🏆 SPRINT 6+ (Month 3-6): SCALE TO STARTUP

## Month 3: Fundraising

### Pre-Seed Round ($250K)
**Deck structure:**
1. Problem: DeFi is overcollateralized
2. Solution: Temporal reputation = undercollateralized lending
3. Traction: $100K TVL, 100 users, <$5K bad debt
4. Team: You + advisors
5. Vision: New crypto primitive beyond lending
6. Ask: $250K for 10% equity

**Target investors:**
- DeFi angels (ex-Aave, ex-Compound founders)
- Crypto VCs (Dragonfly, Variant, 1kx)
- Strategic: Alchemy, Arbitrum Foundation

---

## Month 4: Team Building

**Hire 3 people ($250K budget):**

**Solidity Dev ($80K/year):**
- Build proxy upgrades
- Add ERC20 support
- Build reputation primitives

**Frontend Dev ($70K/year):**
- Build full Aave-style dashboard
- Add analytics
- Mobile responsive

**Economist ($60K/year):**
- Run Monte Carlo simulations
- Tune parameters
- Research reputation scoring

**Save $40K for operations**

---

## Month 5-6: Product Expansion

### Feature Roadmap

**1. ERC20 Support**
- Query historical token balances
- Support USDC, WBTC, stETH
- Multi-asset reputation

**2. Governance Primitive**
- Prove "held governance token for X months"
- Get boosted voting power
- Partner with DAOs

**3. Identity/OG Status**
- Prove "held ETH since 2017"
- Mint "Ethereum OG" NFT
- Sell as status symbol

**4. Loyalty Programs**
- Partner with crypto brands
- Reward long-term holders
- Revenue sharing

---

# 💰 FINANCIAL PROJECTIONS

## Year 1 Revenue Model

**Assumptions:**
- Avg TVL: $1M
- Borrow volume: $500K/month
- Origination fee: 2%
- Avg APR: 10%

**Revenue:**
- Origination fees: $500K × 2% × 12 = $120K/year
- Interest (protocol keeps 10%): $1M × 10% × 10% = $10K/year
- **Total: $130K/year**

**Expenses:**
- Team (3 people): $210K/year
- Infrastructure: $10K/year
- Legal/compliance: $20K/year
- **Total: $240K/year**

**Burn rate:** -$110K/year
**Runway:** 27 months with $250K raise

---

## Path to Profitability

**Need $1.5M TVL to break even:**
- $1.5M × 10% APR × 10% protocol fee = $15K/year from interest
- $1M/month borrow × 2% × 12 = $240K/year from fees
- **Total: $255K/year revenue > $240K expenses**

**Timeline to $1.5M TVL:**
- Month 3: $100K
- Month 6: $500K
- Month 9: $1M
- Month 12: $2M (profitable)

---

# 🎯 SUCCESS METRICS BY SPRINT

**Sprint 1 (Week 2):**
- ✅ Testnet live
- ✅ 10 users tested
- ✅ 0 critical bugs

**Sprint 2 (Week 4):**
- ✅ Exploits patched
- ✅ $100 bounty paid
- ✅ 50 testnet users

**Sprint 3 (Week 6):**
- ✅ ZK proofs working
- ✅ Base deployment
- ✅ Cross-chain sync

**Sprint 4 (Week 8):**
- ✅ Economic model validated
- ✅ <5% bad debt simulated
- ✅ 3 indexers running

**Sprint 5 (Week 10):**
- ✅ Mainnet beta live
- ✅ $100K TVL
- ✅ 50 beta users
- ✅ <$5K bad debt

**Sprint 6 (Month 6):**
- ✅ $250K raised
- ✅ 3 team members
- ✅ $1M TVL
- ✅ Path to profitability

---

# 🔥 NEXT ACTION

**THIS WEEKEND (Sprint 1, Day 1-2):**

1. Get testnet ETH from faucet
2. Deploy contracts to Arbitrum Sepolia
3. Celebrate on Twitter

**Type "EXECUTE" and I'll start building Sprint 1 code RIGHT NOW.**
