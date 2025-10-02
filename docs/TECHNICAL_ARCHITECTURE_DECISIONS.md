# Technical Architecture Decisions - Temporal Credit Protocol

## 🎯 CRITICAL DECISIONS TO MAKE NOW

---

## 1. BLOCKCHAIN PLATFORM SELECTION

### ✅ RECOMMENDATION: Deploy on **ARBITRUM ONE** (Primary) + **BASE** (Secondary)

### Why Arbitrum One?
- **Market Leader**: 51% L2 market share, $1B+ TVL
- **DeFi Ecosystem**: 600+ dApps, proven lending protocols (Aave, GMX)
- **Cost**: 95% cheaper than Ethereum mainnet (~$0.10-0.50 per tx)
- **Speed**: 40,000 TPS capacity, ~0.3s finality
- **Security**: Inherits Ethereum security via optimistic rollup
- **Tooling**: Full Ethereum compatibility, works with all existing tools
- **Archive Nodes**: Alchemy/Infura support historical queries (critical for us!)

### Why Base as Secondary?
- **Coinbase Backing**: Easiest fiat on/off ramp for users
- **Growth**: Fastest-growing L2 by developer count
- **Cost**: Sub-cent transactions
- **Speed**: 1-second block times
- **Cross-chain**: Native bridge to Ethereum L1

### Deployment Strategy:
```
Phase 1 (Testnet): Arbitrum Sepolia + Base Sepolia
Phase 2 (Mainnet): Arbitrum One (primary)
Phase 3 (Expansion): Base, Optimism, Polygon zkEVM
```

**ANSWER: We're NOT building a new chain. We're deploying on existing L2s (Arbitrum + Base).**

---

## 2. ZK PROOF IMPLEMENTATION

### ✅ RECOMMENDATION: **Hybrid Groth16 + Plonky2**

### Architecture:
```
┌─────────────────────────────────────────┐
│         ZK Proof System                 │
├─────────────────────────────────────────┤
│                                         │
│  Groth16 (On-chain verification)       │
│  - Fast verification (~100K gas)        │
│  - Small proof size (256 bytes)         │
│  - Use for: Dispute resolution         │
│                                         │
│  Plonky2 (Off-chain generation)        │
│  - Recursive proofs                     │
│  - <1s generation time                  │
│  - Use for: Temporal aggregation       │
│                                         │
│  Circom + SnarkJS (Circuit)            │
│  - Merkle tree verification             │
│  - Balance checks                       │
│  - Temporal continuity                  │
│                                         │
└─────────────────────────────────────────┘
```

### Implementation Plan:

#### Week 1-2: Circom Circuit
```circom
pragma circom 2.1.0;

include "circomlib/poseidon.circom";
include "circomlib/merkle_tree.circom";

template TemporalOwnership(levels) {
    // Inputs
    signal input balances[52];        // Weekly balances for 1 year
    signal input minBalance;          // Minimum required
    signal input merkleRoot;          // Block state root
    signal input merkleProofs[52][levels]; // Proofs for each sample

    // Output
    signal output isValid;

    // Verify each balance
    component checkers[52];
    for (var i = 0; i < 52; i++) {
        checkers[i] = GreaterEqThan(64);
        checkers[i].in[0] <== balances[i];
        checkers[i].in[1] <== minBalance;
    }

    // Verify Merkle proofs
    component merkle[52];
    for (var i = 0; i < 52; i++) {
        merkle[i] = MerkleTreeChecker(levels);
        merkle[i].leaf <== balances[i];
        merkle[i].root <== merkleRoot;
        merkle[i].pathElements <== merkleProofs[i];
    }

    // All checks must pass
    signal accumulator;
    accumulator <== 1;
    for (var i = 0; i < 52; i++) {
        accumulator <== accumulator * checkers[i].out * merkle[i].out;
    }

    isValid <== accumulator;
}

component main = TemporalOwnership(20); // 20-level Merkle tree
```

#### Week 3: Trusted Setup
```bash
# Powers of Tau ceremony (use existing)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau

# Circuit-specific setup
snarkjs groth16 setup temporal.r1cs pot20_final.ptau temporal_0000.zkey

# Contribution (for production)
snarkjs zkey contribute temporal_0000.zkey temporal_final.zkey

# Export verification key
snarkjs zkey export verificationkey temporal_final.zkey verification_key.json
```

#### Week 4: Integration
- Proof generation service (Node.js + SnarkJS)
- Browser proof generation (WASM)
- Smart contract verifier (Solidity)

### Gas Costs:
- **Optimistic claim**: 80K gas (~$0.50 on Arbitrum)
- **ZK dispute**: 250K gas (~$1.50 on Arbitrum)
- **Expected cost per user**: $0.50 (99% optimistic) + $0.015 (1% disputes) = **$0.515 average**

---

## 3. CROSS-CHAIN ARCHITECTURE

### ✅ RECOMMENDATION: **LayerZero V2** (Primary) + **Wormhole** (Fallback)

### Why LayerZero V2?
- **Omnichain**: Native cross-chain messaging
- **Security**: Decentralized verification network (DVN)
- **Cost**: $0.10-0.50 per message
- **Speed**: <1 minute cross-chain finality
- **Adoption**: Used by Stargate, Radiant, Tapioca

### Why Wormhole as Fallback?
- **Reliability**: Guardians with stake
- **Coverage**: 30+ chains
- **Cost**: Similar to LayerZero
- **Redundancy**: Critical for slashing operations

### Implementation:
```solidity
// Already in ReputationOracle.sol
function _syncCrossChain(address user, SlashAction action, uint256 severity) internal {
    bytes memory payload = abi.encode(user, action, severity);

    for (uint256 i = 0; i < supportedChains.length; i++) {
        try this._sendViaLayerZero(chainId, payload) {
            emit CrossChainSuccess(chainId, "LayerZero");
        } catch {
            try this._sendViaWormhole(chainId, payload) {
                emit CrossChainSuccess(chainId, "Wormhole");
            } catch {
                emit CrossChainFailure(chainId);
            }
        }
    }
}
```

### Supported Chains (Launch):
1. Arbitrum One (primary)
2. Base (secondary)
3. Ethereum L1 (for high-value users)

### Expansion Plan:
- Q2 2026: Optimism, Polygon zkEVM
- Q3 2026: Solana (via Wormhole)
- Q4 2026: Avalanche, BNB Chain

---

## 4. ORACLE & DATA AVAILABILITY

### ✅ RECOMMENDATION: **Alchemy Archive Nodes** + **The Graph**

### Architecture:
```
┌───────────────────────────────────────────┐
│         Data Infrastructure               │
├───────────────────────────────────────────┤
│                                           │
│  Alchemy Archive Nodes                    │
│  - Historical balance queries             │
│  - Block state access                     │
│  - 100% uptime SLA                        │
│  - Cost: $499/month (Growth plan)         │
│                                           │
│  The Graph (Indexing)                     │
│  - Event indexing                         │
│  - GraphQL API                            │
│  - Decentralized network                  │
│  - Cost: Pay-per-query ($0.0001/query)    │
│                                           │
│  Redis Cache                              │
│  - Hot data caching                       │
│  - Query result caching                   │
│  - 99.99% hit rate on common queries      │
│                                           │
└───────────────────────────────────────────┘
```

### The Graph Subgraph:
```graphql
type Claim @entity {
  id: ID!
  user: Bytes!
  minBalance: BigInt!
  startBlock: BigInt!
  endBlock: BigInt!
  status: ClaimStatus!
  merkleRoot: Bytes!
  stake: BigInt!
  createdAt: BigInt!
  challengedBy: Bytes
  finalizedAt: BigInt
}

type Reputation @entity {
  id: ID!
  user: Bytes!
  score: Int!
  ageMonths: Int!
  isSlashed: Boolean!
  slashSeverity: Int
  lastUpdated: BigInt!
}

type Loan @entity {
  id: ID!
  borrower: Bytes!
  principal: BigInt!
  collateral: BigInt!
  apr: Int!
  poolType: PoolType!
  active: Boolean!
  liquidatedAt: BigInt
}
```

### Cost Breakdown:
- Alchemy Archive: $499/month
- The Graph hosting: $100/month (self-hosted) or $0.0001/query (decentralized)
- Redis: $50/month (AWS ElastiCache)
- **Total**: ~$650/month for data infrastructure

---

## 5. INDEXER NETWORK IMPLEMENTATION

### ✅ RECOMMENDATION: **TypeScript + PostgreSQL + Redis**

### Tech Stack:
```yaml
Language: TypeScript (Node.js 20+)
  Why: Fast development, ethers.js integration, easy hiring

Database: PostgreSQL 15 + TimescaleDB
  Why: Time-series data, excellent indexing, ACID compliance

Cache: Redis 7
  Why: Sub-millisecond queries, pub/sub for real-time

Blockchain: ethers.js v6 + WebSocket
  Why: Most mature library, event listening, archive queries

API: Apollo Server (GraphQL)
  Why: Real-time subscriptions, efficient queries, typed

Queue: BullMQ (Redis-based)
  Why: Job scheduling, retry logic, challenge queue

Monitoring: Prometheus + Grafana
  Why: Industry standard, time-series metrics
```

### Architecture:
```
┌─────────────────────────────────────────────────────┐
│              Indexer Network                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Scanner Service                                    │
│  ├─ Event listener (WebSocket)                     │
│  ├─ Block processor (batch)                        │
│  └─ Checkpoint manager                             │
│                                                     │
│  Validator Service                                  │
│  ├─ Claim validator (archive queries)              │
│  ├─ Fraud detection (ML heuristics)                │
│  └─ Profitability calculator                       │
│                                                     │
│  Challenger Service                                 │
│  ├─ Challenge queue (BullMQ)                       │
│  ├─ Gas price monitor                              │
│  └─ Transaction submitter                          │
│                                                     │
│  API Service (GraphQL)                             │
│  ├─ Query resolvers                                │
│  ├─ Mutation handlers                              │
│  └─ WebSocket subscriptions                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Deployment:
```yaml
Development: Docker Compose
Staging: AWS ECS (Fargate)
Production: Kubernetes (EKS)

Compute:
  - Scanner: t3.medium (2 vCPU, 4GB RAM)
  - Validator: t3.large (2 vCPU, 8GB RAM)
  - API: t3.medium (2 vCPU, 4GB RAM)
  - Database: db.t3.large (2 vCPU, 8GB RAM)

Cost: ~$300/month (AWS)
```

---

## 6. FRONTEND ARCHITECTURE

### ✅ RECOMMENDATION: **Next.js 14 + Wagmi + Privy**

### Tech Stack:
```yaml
Framework: Next.js 14 (App Router)
  Why: SSR, SEO, performance, Vercel deployment

Wallet: Wagmi v2 + Privy
  Why: Best UX, embedded wallets, social login, MFA

State: Zustand + React Query
  Why: Simple, performant, server state management

UI: TailwindCSS + shadcn/ui
  Why: Fast development, consistent design, accessible

ZK: SnarkJS (WASM)
  Why: Browser-based proof generation

Charts: Recharts
  Why: Reputation visualization, APR charts

Analytics: PostHog
  Why: Self-hosted, privacy-first
```

### Key Pages:
```
/                    → Landing page
/app/dashboard       → User dashboard (reputation, loans)
/app/claim           → Submit temporal proof
/app/borrow          → Lending pools
/app/lend            → LP interface
/app/governance      → DAO proposals
```

### ZK Integration:
```typescript
// Proof generation in browser
import { groth16 } from 'snarkjs';

async function generateProof(
  balances: bigint[],
  minBalance: bigint,
  merkleProofs: bigint[][]
) {
  const { proof, publicSignals } = await groth16.fullProve(
    { balances, minBalance, merkleProofs },
    'temporal_js/temporal.wasm',
    'temporal_final.zkey'
  );

  // Convert to Solidity format
  const solidityProof = {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]]
  };

  return { solidityProof, publicSignals };
}
```

### Deployment:
- Vercel (free tier for MVP, $20/month for production)
- CDN: Cloudflare (free)
- Domain: $10/year

---

## 7. SECURITY ARCHITECTURE

### ✅ RECOMMENDATION: **Defense in Depth**

### Layer 1: Smart Contract Security
```
✅ OpenZeppelin contracts (audited)
✅ UUPS upgradeable pattern
✅ ReentrancyGuard on all external functions
✅ Custom errors (gas optimization)
✅ Access control (roles)
✅ Circuit breakers
✅ Timelock (2 days) for governance
```

### Layer 2: Application Security
```
- Rate limiting (1000 req/min per IP)
- DDoS protection (Cloudflare)
- API authentication (JWT)
- Database encryption at rest
- SSL/TLS for all connections
- Secrets in AWS Secrets Manager
- Private key in hardware wallet (Ledger)
```

### Layer 3: Operational Security
```
- Multi-sig treasury (3/5 Gnosis Safe)
- Incident response plan
- Bug bounty ($500K on Immunefi)
- Regular penetration testing
- Smart contract monitoring (Forta)
- Emergency pause mechanism
```

### Audit Strategy:
```
Phase 1: Internal audit (Slither, Mythril, Aderyn)
Phase 2: Community audit (Code4rena contest - $50K)
Phase 3: Professional audits:
  - Trail of Bits ($100K, 4 weeks)
  - Consensys Diligence ($80K, 3 weeks)
  - zkSecurity for ZK circuits ($40K, 2 weeks)

Total audit budget: $270K
```

---

## 8. INFRASTRUCTURE COSTS (Monthly)

### Development/Testnet:
```
Alchemy testnet RPC: $0 (free tier)
The Graph testnet: $0 (free)
AWS staging: $100
Domain: $1
Total: ~$100/month
```

### Production (Launch):
```
Alchemy archive nodes: $499
The Graph hosting: $100
AWS production (ECS): $300
PostgreSQL RDS: $150
Redis ElastiCache: $50
Monitoring (Grafana Cloud): $50
Domain + SSL: $10
CDN (Cloudflare): $0 (free)
Vercel Pro: $20

Total: ~$1,180/month
```

### At Scale (1M users):
```
Alchemy Enterprise: $2,000
AWS (auto-scaled): $1,500
Database (scaled): $500
The Graph queries: $500
CDN (Cloudflare Pro): $200

Total: ~$4,700/month
```

---

## 9. DEVELOPMENT TIMELINE (REALISTIC)

### Sprint 1-2 (Weeks 1-2): Foundation
```
✅ Smart contracts (DONE)
✅ Tests (DONE)
⏳ Deploy to Arbitrum Sepolia
⏳ Deploy to Base Sepolia
⏳ Verify contracts on Arbiscan/Basescan
⏳ Setup The Graph subgraph
⏳ Configure LayerZero endpoints
```

### Sprint 3-4 (Weeks 3-4): Backend
```
⏳ Complete indexer scanner
⏳ Build claim validator
⏳ Implement auto-challenger
⏳ Setup PostgreSQL + migrations
⏳ Build GraphQL API
⏳ Add WebSocket subscriptions
⏳ Write integration tests
```

### Sprint 5-6 (Weeks 5-6): ZK Circuits
```
⏳ Finalize Circom circuit
⏳ Run trusted setup ceremony
⏳ Build proof generation service
⏳ Integrate with frontend
⏳ Test end-to-end ZK flow
⏳ Optimize proof generation time
```

### Sprint 7-8 (Weeks 7-8): Frontend
```
⏳ Next.js setup + Wagmi
⏳ Wallet connection (Privy)
⏳ Claim submission UI
⏳ Dashboard (reputation display)
⏳ Borrow/lend interface
⏳ Governance UI
⏳ Mobile responsive
```

### Sprint 9-10 (Weeks 9-10): Testing & QA
```
⏳ End-to-end testing
⏳ Load testing (K6)
⏳ Security review (internal)
⏳ Bug fixes
⏳ Performance optimization
⏳ Documentation
⏳ Beta user onboarding
```

### Sprint 11-12 (Weeks 11-12): Audit Prep
```
⏳ Code freeze
⏳ Audit preparation docs
⏳ Submit to auditors
⏳ Community bug bounty (Code4rena)
⏳ Fix audit findings
⏳ Mainnet deployment scripts
```

### Sprint 13-14 (Weeks 13-14): Launch
```
⏳ Deploy to Arbitrum mainnet
⏳ Deploy to Base mainnet
⏳ Initialize liquidity pools
⏳ Marketing campaign
⏳ Launch on Product Hunt
⏳ Monitor metrics
⏳ Scale infrastructure
```

**Total time: 14 weeks (~3.5 months)**

---

## 10. RISK MITIGATION

### Technical Risks:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Smart contract bug | Medium | Critical | 3 audits, formal verification |
| ZK circuit flaw | Low | High | zkSecurity audit, test vectors |
| Indexer downtime | Medium | Medium | Multi-region deployment, alerts |
| Archive node failure | Low | High | Multiple RPC providers (Alchemy + Infura) |
| Cross-chain failure | Medium | High | Dual-bridge redundancy |

### Business Risks:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | Critical | Marketing, UX focus, liquidity incentives |
| Regulatory action | Low | Critical | Legal review, no token initially, compliance |
| Competitor launch | High | Medium | First-mover speed, superior UX |
| Liquidity crisis | Medium | High | Circuit breakers, conservative LTV |

---

## 🎯 FINAL ARCHITECTURE SUMMARY

### What We're Building:
```
Layer 1: Ethereum (for security)
Layer 2: Arbitrum One + Base (for execution)
ZK System: Circom + Groth16 + Plonky2
Cross-chain: LayerZero V2 + Wormhole
Indexer: TypeScript + PostgreSQL + Redis
Frontend: Next.js + Wagmi + Privy
Deployment: AWS (backend) + Vercel (frontend)
```

### NOT Building:
- ❌ New blockchain
- ❌ New L2 rollup
- ❌ New consensus mechanism
- ❌ Centralized servers (decentralizing indexers over time)

### Key Innovations:
1. **Temporal Ownership Proofs** (novel ZK primitive)
2. **Hybrid Optimistic-ZK** (99% cheap, 1% secure)
3. **Cross-chain Reputation** (portable across chains)
4. **Soulbound NFTs** (prevents reputation rental)

---

## 📋 IMMEDIATE NEXT STEPS

1. ✅ **Choose name** → EON PROTOCOL recommended
2. ⏳ **Deploy to testnet** → Arbitrum Sepolia (this week)
3. ⏳ **Complete backend indexer** → 2 weeks
4. ⏳ **Build ZK circuits** → 2 weeks
5. ⏳ **Create frontend** → 4 weeks
6. ⏳ **Security audits** → 6 weeks
7. ⏳ **Mainnet launch** → Week 14

**THIS IS REAL. THIS WILL WORK. LET'S BUILD IT.** 🚀
