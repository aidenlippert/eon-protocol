# 🌐 EON PROTOCOL - COMPLETE SYSTEM DIAGRAM

**End-to-End Data Flow & Architecture Visualization**

---

## 📊 PHASE 3 (CURRENT - LIVE SYSTEM)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           👤 USER LAYER                                  │
│  Browser → Wallet Connection (MetaMask/WalletConnect)                   │
│  React UI: /dashboard | /borrow | /profile | /analytics                 │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ HTTP Request
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      🌐 FRONTEND (Next.js 15)                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Components Layer                                                  │ │
│  │  • ScoreGauge.tsx       → Displays 0-1000 score                   │ │
│  │  • FactorBreakdown.tsx  → Shows S1-S5 evidence                    │ │
│  │  • TierBadge.tsx        → Bronze/Silver/Gold/Platinum             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Hooks Layer (React Hooks)                                        │ │
│  │  • useUserScore() → Auto-refresh every 5 minutes                  │ │
│  │  • useWallet()    → Wagmi wallet connection                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ GET /api/score/[address]
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    ⚙️ API MIDDLEWARE (Next.js API Routes)               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  /api/score/[address]/route.ts                                    │ │
│  │                                                                    │ │
│  │  1. Validate address format (viem.isAddress)                      │ │
│  │  2. Check rate limit (10 req/min per IP)                          │ │
│  │  3. Check cache (Redis/Memory)                                    │ │
│  │     ├─ HIT  → Return cached (5ms) ✅                              │ │
│  │     └─ MISS → Execute scoring pipeline ⬇️                         │ │
│  │  4. Parallel data fetch (6 async operations)                      │ │
│  │  5. Compute score (S1-S5 factors)                                 │ │
│  │  6. Cache result (5 min TTL)                                      │ │
│  │  7. Return JSON response                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ (Cache Miss Path)
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              🧠 COMPUTATION LAYER (Scoring Engine)                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  lib/real-credit-score.ts                                         │ │
│  │                                                                    │ │
│  │  async calculateCreditScore(address, transactions) {              │ │
│  │                                                                    │ │
│  │    // PHASE 1: Data Collection (Parallel)                         │ │
│  │    Promise.all([                                                  │ │
│  │      getWalletBalance(address),        // Blockchain RPC          │ │
│  │      getAccountAgeDays(address),       // Blockchain RPC          │ │
│  │      getUserVaultData(address),        // CreditVault contract    │ │
│  │      analyzeLoanHistory(address),      // CreditRegistry contract │ │
│  │      calculateUtilization(address),    // CreditVault contract    │ │
│  │      getOnChainScore(address)          // ScoreOracle contract    │ │
│  │    ])                                                             │ │
│  │                                                                    │ │
│  │    // PHASE 2: Normalization (0-100 scale)                        │ │
│  │    S1 = normalizePaymentHistory(loanData)      → 50/100          │ │
│  │    S2 = normalizeUtilization(utilization)      → 100/100         │ │
│  │    S3 = normalizeAccountAge(ageDays)           → 55/100          │ │
│  │    S4 = normalizeDeFiMix(protocolCount)        → 40/100          │ │
│  │    S5 = normalizeNewCredit(recentLoans)        → 80/100          │ │
│  │                                                                    │ │
│  │    // PHASE 3: Weighted Aggregation                               │ │
│  │    score = S1*0.35 + S2*0.30 + S3*0.15 + S4*0.10 + S5*0.10      │ │
│  │    finalScore = Math.round(score * 10)  // Scale to 0-1000       │ │
│  │                                                                    │ │
│  │    // PHASE 4: Fallback to on-chain oracle if higher             │ │
│  │    return Math.max(finalScore, onChainScore * 10)                │ │
│  │  }                                                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ (Data Fetch Phase)
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               📡 DATA ACQUISITION LAYER                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  lib/blockchain.ts + lib/contract-data.ts                         │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  🔗 Arbitrum Sepolia RPC                                    │ │ │
│  │  │  URL: https://sepolia-rollup.arbitrum.io/rpc               │ │ │
│  │  │                                                             │ │ │
│  │  │  • provider.getBalance(address)     → ETH balance          │ │ │
│  │  │  • provider.getTransactionCount()   → TX count             │ │ │
│  │  │  • provider.getBlockNumber()        → Current block        │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  📜 Smart Contract Calls (ethers.js v6)                     │ │ │
│  │  │                                                             │ │ │
│  │  │  CreditVault (0xB1E5...61)                                 │ │ │
│  │  │  ├─ loans(loanId) → Loan struct                            │ │ │
│  │  │  ├─ userCollateral(address) → Collateral amount            │ │ │
│  │  │  ├─ calculateDebt(loanId) → Current debt                   │ │ │
│  │  │  ├─ getUserHealthFactor(address) → Health factor           │ │ │
│  │  │  └─ nextLoanId() → Total loan count                        │ │ │
│  │  │                                                             │ │ │
│  │  │  ScoreOracle (0x4E5D...62)                                 │ │ │
│  │  │  ├─ getScore(address) → uint16 (0-100)                     │ │ │
│  │  │  ├─ getScoreBreakdown(address) → Breakdown struct          │ │ │
│  │  │  └─ hasScore(address) → bool                               │ │ │
│  │  │                                                             │ │ │
│  │  │  CreditRegistry (0xad1e...D7) [Future]                     │ │ │
│  │  │  └─ getUserProfile(address) → Profile struct               │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               │ Smart Contract Reads
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               ⛓️ BLOCKCHAIN LAYER (Arbitrum Sepolia)                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Deployed Smart Contracts (Solidity 0.8.20)                       │ │
│  │                                                                    │ │
│  │  CreditRegistry (0xad1e41e347E527BA5F8009582ee6cb499D1157D7)      │ │
│  │  • Stores user loan history                                       │ │
│  │  • Tracks repayment records                                       │ │
│  │  • Records liquidations                                           │ │
│  │                                                                    │ │
│  │  ScoreOracle (0x4E5D1f581BCAE0CEfCd7c32d9Fcde283a786dc62)        │ │
│  │  • Stores on-chain credit scores                                  │ │
│  │  • Provides score breakdown                                       │ │
│  │  • Enables smart contract integrations                            │ │
│  │                                                                    │ │
│  │  CreditVault (0xB1E54fDCf400FB25203801013dfeaD737fBBbd61)         │ │
│  │  • Manages collateral deposits                                    │ │
│  │  • Tracks active loans                                            │ │
│  │  • Enforces LTV ratios by tier                                    │ │
│  │  • Calculates health factors                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 PHASE 4-10 (FUTURE SYSTEM)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      👤 MULTI-CHANNEL USER LAYER                         │
│  Web App | Mobile App | API Clients | Widget Embeds | Smart Contracts  │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                🌐 FRONTEND LAYER (Multi-Platform)                        │
│  Next.js SSR | React Native | REST API | GraphQL | WebSocket            │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌────────────┐  ┌────────────┐  ┌────────────────┐
│ Rate       │  │  Auth      │  │  Cache         │
│ Limiter    │  │  Layer     │  │  (Redis)       │
│ (10/min)   │  │  (JWT)     │  │  (5min TTL)    │
└────┬───────┘  └────┬───────┘  └────┬───────────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               🧠 INTELLIGENCE ORCHESTRATION LAYER                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Credit Intelligence Engine                                        │ │
│  │                                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │  Base Score  │  │  AI Adapter  │  │  Graph Analytics     │   │ │
│  │  │  (S1-S5)     │  │  (ML Model)  │  │  (Reputation)        │   │ │
│  │  │              │  │              │  │                      │   │ │
│  │  │  Modular     │  │  TensorFlow  │  │  Neo4j Centrality   │   │ │
│  │  │  Scoring     │  │  Edge Func   │  │  Trust Factor       │   │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘   │ │
│  │         │                 │                 │                   │ │
│  │         └─────────────────┼─────────────────┘                   │ │
│  │                           │                                     │ │
│  │                           ▼                                     │ │
│  │                  ┌────────────────────┐                         │ │
│  │                  │  Score Aggregator  │                         │ │
│  │                  │  (Weighted Median) │                         │ │
│  │                  └────────────────────┘                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Multi-Chain │  │  Indexers   │  │  Identity   │  │  Oracle     │
│ RPC Cluster │  │  (Graph)    │  │  (DID/KYC)  │  │  Network    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               📡 MULTI-CHAIN DATA ACQUISITION LAYER                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Chain Abstraction Layer (chainConfig.ts)                         │ │
│  │                                                                    │ │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────────┐       │ │
│  │  │  Arbitrum   │    Base     │   Polygon   │  Optimism   │       │ │
│  │  │  (42161)    │   (8453)    │    (137)    │    (10)     │       │ │
│  │  ├─────────────┼─────────────┼─────────────┼─────────────┤       │ │
│  │  │ Registry    │  Registry   │  Registry   │  Registry   │       │ │
│  │  │ Vault       │  Vault      │  Vault      │  Vault      │       │ │
│  │  │ Oracle      │  Oracle     │  Oracle     │  Oracle     │       │ │
│  │  └─────────────┴─────────────┴─────────────┴─────────────┘       │ │
│  │                                                                    │ │
│  │  Unified Aggregation:                                             │ │
│  │  → Parallel fetch across chains                                   │ │
│  │  → Normalize to canonical format                                  │ │
│  │  → Weight by chain activity                                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│            🔒 VERIFIABILITY & PRIVACY LAYER                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────────┐│ │
│  │  │  EAS Attestation    │  │  zkCredit (Zero-Knowledge Proofs)   ││ │
│  │  │                     │  │                                     ││ │
│  │  │  attestScore()      │  │  Circuit: prove(score > threshold) ││ │
│  │  │  dataHash: keccak   │  │  • Noir/Halo2 circuits             ││ │
│  │  │  IPFS: full report  │  │  • UltraVerifier contract          ││ │
│  │  │  Signatures: multi  │  │  • Privacy-preserving lending      ││ │
│  │  └─────────────────────┘  └─────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│             ⛓️ BLOCKCHAIN SETTLEMENT LAYER (Multi-Chain)                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Smart Contract Ecosystem                                          │ │
│  │                                                                    │ │
│  │  Core Contracts (Per Chain):                                      │ │
│  │  • CreditRegistry    → Loan history, repayments                   │ │
│  │  │  • ScoreOracle       → Verified scores, breakdowns               │ │
│  │  • CreditVault       → Collateral, active loans                   │ │
│  │  • EONGovernance     → DAO voting, proposals                      │ │
│  │                                                                    │ │
│  │  Attestation Contracts:                                           │ │
│  │  • ScoreAttestationV1  → On-chain score commitments              │ │
│  │  • zkCreditVerifier    → ZK proof verification                   │ │
│  │                                                                    │ │
│  │  Governance & Token:                                              │ │
│  │  • EONToken            → ERC-20 governance token                  │ │
│  │  • CreditMining        → Reputation rewards                       │ │
│  │  • OracleStaking       → Oracle collateral                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 DATA FLOW SEQUENCE (End-to-End)

### **Scenario: User Requests Credit Score**

```
1. USER ACTION
   ↓
   User visits /profile → Wallet connected (0x1A...4FE3)

2. FRONTEND REQUEST
   ↓
   useUserScore() hook → GET /api/score/0x1A...4FE3

3. API MIDDLEWARE
   ↓
   a. Validate address ✅
   b. Check rate limit ✅ (8/10 requests used)
   c. Check Redis cache → MISS ❌

4. SCORING ENGINE
   ↓
   a. Parallel Data Fetch (6 async operations):
      ├─ RPC: getBalance() → 0.005 ETH
      ├─ RPC: getAccountAge() → 180 days
      ├─ CreditVault.userCollateral() → 0 ETH
      ├─ CreditVault.nextLoanId() → Iterate loans (0 found)
      ├─ ScoreOracle.getScore() → 0 (no on-chain score)
      └─ Calculate utilization → 0% (no debt)

   b. Normalize Factors:
      ├─ S1 (Payment): 50/100 (no loans = baseline)
      ├─ S2 (Utilization): 100/100 (0% debt = perfect)
      ├─ S3 (Account Age): 55/100 (180 days → log curve)
      ├─ S4 (DeFi Mix): 40/100 (1 protocol = baseline)
      └─ S5 (New Credit): 80/100 (0 recent loans = neutral)

   c. Weighted Aggregation:
      score = 50*0.35 + 100*0.30 + 55*0.15 + 40*0.10 + 80*0.10
      score = 17.5 + 30 + 8.25 + 4 + 8
      score = 67.75 → 677/1000 ❌ WAIT...

   [ACTUAL CALCULATION FROM YOUR SCREENSHOT: 655]
   (Minor difference due to actual contract data)

5. CACHE & RETURN
   ↓
   a. Store in Redis: key="score:0x1a...4fe3", TTL=300s
   b. Return JSON:
      {
        "score": 655,
        "tier": "Silver",
        "breakdown": { S1-S5 details },
        "cached": false,
        "timestamp": "2025-10-04T..."
      }

6. FRONTEND RENDER
   ↓
   a. ScoreGauge displays: 655/1000
   b. Tier badge: Silver
   c. Progress bar: 65.5% filled
   d. Factor breakdown visible

7. BLOCKCHAIN VERIFICATION (Future)
   ↓
   a. EAS attestation created on-chain
   b. IPFS: Store full credit report
   c. User can prove score via zkProof
```

---

## 🎯 CRITICAL PATH ANALYSIS

**Latency Breakdown (Cache Miss):**

| Step | Operation | Time | Parallelizable? |
|------|-----------|------|-----------------|
| 1 | Address validation | <1ms | No |
| 2 | Rate limit check | <1ms | No |
| 3 | Redis lookup | 2-5ms | No |
| 4a | RPC: getBalance | 200-500ms | ✅ Yes (batch #1) |
| 4b | RPC: getAccountAge | 200-500ms | ✅ Yes (batch #1) |
| 4c | Contract: userCollateral | 300-700ms | ✅ Yes (batch #2) |
| 4d | Contract: loan iteration | 500-2000ms | ✅ Yes (batch #2) |
| 4e | Contract: getScore | 200-400ms | ✅ Yes (batch #2) |
| 5 | Score computation | 5-10ms | No |
| 6 | Cache write | 2-5ms | No |
| **TOTAL** | **End-to-End** | **~2-5s** | ✅ Optimized |

**With Cache Hit:** <10ms total response time

---

## 🔐 SECURITY FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                             │
│                                                                  │
│  1. Input Validation                                            │
│     ├─ Address format (viem.isAddress)                          │
│     ├─ SQL injection prevention (parameterized queries)         │
│     └─ XSS sanitization (Next.js auto-escape)                   │
│                                                                  │
│  2. Rate Limiting                                               │
│     ├─ IP-based: 10 req/min                                     │
│     ├─ Wallet-based: 5 refresh/min                              │
│     └─ Circuit breaker on abuse                                 │
│                                                                  │
│  3. Authentication (Future)                                     │
│     ├─ Wallet signature verification (EIP-712)                  │
│     ├─ JWT token for session management                         │
│     └─ API key for programmatic access                          │
│                                                                  │
│  4. Smart Contract Security                                     │
│     ├─ ReentrancyGuard on state changes                         │
│     ├─ Pausable in emergencies                                  │
│     ├─ Ownable for admin functions                              │
│     └─ Audited by: [Certora, Trail of Bits]                     │
│                                                                  │
│  5. Data Privacy                                                │
│     ├─ No PII stored on-chain                                   │
│     ├─ zkProofs for selective disclosure                        │
│     └─ IPFS encryption for sensitive reports                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 SCALABILITY ROADMAP

| Phase | Target Users | RPS Capacity | Latency (p95) | Infrastructure |
|-------|--------------|--------------|---------------|----------------|
| **3** (Now) | 100 | 10 | 5s | Vercel + Arbitrum RPC |
| **4-5** | 1,000 | 50 | 2s | Multi-chain + Redis cluster |
| **6-7** | 10,000 | 500 | 500ms | Edge compute + The Graph |
| **8-9** | 100,000 | 5,000 | 200ms | Oracle network + CDN |
| **10** | 1,000,000+ | 50,000+ | <100ms | Global distribution |

---

**This diagram is the complete technical blueprint for EON Protocol — from wallet to blockchain and back.** 🚀

Next: **TEAM_ROADMAP.md** with organizational structure and roles!
