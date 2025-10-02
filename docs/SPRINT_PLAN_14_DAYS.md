# 🚀 2-WEEK SPRINT PLAN: EON PROTOCOL MVP

**Goal**: Transform from working code to REAL, DEPLOYED, FUNCTIONAL product
**Timeline**: 14 days (2 sprints × 7 days)
**Budget**: $500 initial, scaling to grant applications

---

## 📋 SPRINT 1 (Days 1-7): FOUNDATION & DEPLOYMENT

### Day 1 (Monday): Legal & Brand Foundation
**Goal**: Establish legal entity and brand identity

#### Morning (4 hours):
- [ ] **Choose final protocol name** (EON PROTOCOL recommended)
  - Verify domain availability (eon.finance, eonprotocol.com)
  - Check Twitter/GitHub handles (@eonprotocol, @eon_fi)
  - Run trademark search (USPTO.gov free search)

- [ ] **Register entity** ($99)
  - Use Doola.com or Clerky.com
  - Delaware LLC or Cayman Foundation
  - EIN application (free, immediate online)

- [ ] **Domain & Email** ($30)
  - Buy eonprotocol.com via Namecheap
  - Setup founder@eonprotocol.com via Google Workspace ($6/mo)

#### Afternoon (4 hours):
- [ ] **Brand assets** ($20)
  - Logo design via Canva Pro (AI-generated)
  - Color scheme (primary: time-themed blue/purple)
  - Social media banners

- [ ] **Social presence** (Free)
  - Twitter account @eonprotocol
  - GitHub organization: github.com/eon-protocol
  - Discord server setup
  - Telegram group

**Budget Day 1**: $149
**Remaining**: $351

---

### Day 2 (Tuesday): Testnet Deployment
**Goal**: Deploy all contracts to Arbitrum Sepolia + Base Sepolia

#### Morning (4 hours):
- [ ] **Setup deployment environment**
  ```bash
  # Install dependencies
  npm install --save-dev @nomiclabs/hardhat-ethers
  npm install dotenv

  # Get testnet ETH
  # Arbitrum Sepolia: https://faucet.triangleplatform.com/arbitrum/sepolia
  # Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
  ```

- [ ] **Global rename: Chronos → Eon**
  ```bash
  cd /tmp/chronos-contracts
  find . -type f -exec sed -i 's/Chronos/Eon/g' {} +
  find . -type f -exec sed -i 's/chronos/eon/g' {} +
  find . -type f -exec sed -i 's/CHRONOS/EON/g' {} +
  mv ChronosCore.sol EonCore.sol
  mv ChronosNFT.sol EonNFT.sol
  # etc.
  ```

#### Afternoon (4 hours):
- [ ] **Deploy to Arbitrum Sepolia**
  ```bash
  # Deploy sequence
  1. EonCore
  2. EonNFT (pass EonCore address)
  3. ClaimManager (pass NFT, ZK verifier)
  4. ReputationOracle (pass LayerZero, Wormhole, NFT)
  5. LendingPool (pass NFT, Oracle, tokens)
  6. EonGovernance (pass timelock, NFT, Oracle)
  ```

- [ ] **Verify contracts on Arbiscan**
  - Get API key from arbiscan.io
  - Run verification script
  - Document all addresses

**Deliverable**: Live testnet contracts on Arbitrum Sepolia
**Budget Day 2**: $10 (testnet gas from faucets)

---

### Day 3 (Wednesday): Cross-Chain Setup
**Goal**: Configure LayerZero/Wormhole for cross-chain reputation

#### Morning (4 hours):
- [ ] **LayerZero V2 setup**
  - Register on LayerZero testnet
  - Configure endpoints for Arbitrum + Base Sepolia
  - Set trusted remotes
  - Test message passing

- [ ] **Deploy to Base Sepolia**
  - Deploy same contracts to Base
  - Configure cross-chain connections
  - Test slashing across chains

#### Afternoon (4 hours):
- [ ] **The Graph subgraph**
  ```graphql
  # Create subgraph.yaml
  # Define entities: Claim, Reputation, Loan
  # Write mappings for events
  # Deploy to Subgraph Studio (free testnet)
  ```

- [ ] **Test cross-chain flow**
  - Slash user on Arbitrum
  - Verify blacklist propagates to Base
  - Monitor LayerZero explorer

**Deliverable**: Multi-chain deployment with working cross-chain messaging
**Budget Day 3**: $20 (testnet gas)

---

### Day 4 (Thursday): Backend Indexer Core
**Goal**: Complete scanner + validator services

#### Morning (4 hours):
- [ ] **Setup infrastructure**
  ```bash
  # PostgreSQL + Redis via Docker
  docker-compose up -d postgres redis

  # Run migrations
  npx prisma migrate dev

  # Install dependencies
  npm install ethers @prisma/client ioredis
  ```

- [ ] **Complete scanner.ts** (already 70% done)
  - Finish event handlers
  - Add error recovery
  - Implement checkpoint system

#### Afternoon (4 hours):
- [ ] **Build validator.ts**
  ```typescript
  // Claim validation logic
  - Query archive node for historical balances
  - Verify merkle proofs
  - Calculate fraud probability
  - Store validation results
  ```

- [ ] **Test validation**
  - Submit valid claim
  - Submit invalid claim
  - Verify detection accuracy

**Deliverable**: Working indexer scanning + validating claims
**Budget Day 4**: $50 (Alchemy free tier, local dev costs)

---

### Day 5 (Friday): Auto-Challenger + API
**Goal**: Build challenger service and GraphQL API

#### Morning (4 hours):
- [ ] **Build challenger.ts**
  ```typescript
  - Monitor validation results
  - Calculate challenge profitability
  - Submit challenges when EV > $75
  - Handle transaction retries
  - Gas price monitoring
  ```

- [ ] **Setup wallet management**
  - Use AWS KMS or local encrypted keystore
  - Setup challenge wallet with test ETH
  - Implement nonce management

#### Afternoon (4 hours):
- [ ] **Build GraphQL API**
  ```typescript
  // Apollo Server setup
  - Query resolvers (claims, reputation, loans)
  - Mutation handlers (submitClaim, borrow)
  - WebSocket subscriptions (claimStatus, reputationUpdates)
  - Connect to PostgreSQL
  ```

- [ ] **Test full backend**
  - Submit claim via API
  - Watch indexer validate
  - See auto-challenge if invalid

**Deliverable**: Complete backend with auto-challenging
**Budget Day 5**: $30 (testing costs)

---

### Day 6 (Saturday): ZK Circuit Foundation
**Goal**: Build Circom circuit for temporal proofs

#### Morning (4 hours):
- [ ] **Write temporal.circom**
  ```circom
  pragma circom 2.1.0;

  include "circomlib/poseidon.circom";

  template TemporalOwnership(samples, levels) {
      // Inputs: balances, merkle proofs, min threshold
      // Output: isValid (0 or 1)
      // Logic: verify all balances >= min AND merkle proofs valid
  }

  component main = TemporalOwnership(52, 20);
  ```

- [ ] **Compile circuit**
  ```bash
  circom temporal.circom --r1cs --wasm --sym
  # Output: temporal.r1cs, temporal.wasm
  ```

#### Afternoon (4 hours):
- [ ] **Trusted setup**
  ```bash
  # Download Powers of Tau (reuse existing ceremony)
  wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau

  # Circuit-specific setup
  snarkjs groth16 setup temporal.r1cs pot20_final.ptau temporal_0000.zkey

  # Contribute (your randomness)
  snarkjs zkey contribute temporal_0000.zkey temporal_final.zkey

  # Export verification key
  snarkjs zkey export verificationkey temporal_final.zkey vkey.json

  # Export Solidity verifier
  snarkjs zkey export solidityverifier temporal_final.zkey Verifier.sol
  ```

**Deliverable**: Working ZK circuit with verifier contract
**Budget Day 6**: $0 (all open-source tools)

---

### Day 7 (Sunday): ZK Integration + Sprint Review
**Goal**: Integrate ZK proofs end-to-end

#### Morning (4 hours):
- [ ] **Deploy Verifier.sol**
  - Deploy to Arbitrum Sepolia
  - Update ClaimManager with verifier address
  - Test on-chain verification

- [ ] **Build proof service**
  ```typescript
  // Node.js proof generation
  import { groth16 } from 'snarkjs';

  async function generateProof(claim) {
      const balances = await fetchHistoricalBalances(claim);
      const merkleProofs = buildMerkleProofs(balances);

      const { proof, publicSignals } = await groth16.fullProve({
          balances,
          minBalance: claim.minBalance,
          merkleProofs
      }, 'temporal.wasm', 'temporal_final.zkey');

      return formatForSolidity(proof);
  }
  ```

#### Afternoon (4 hours):
- [ ] **End-to-end ZK test**
  - Submit claim
  - Challenge claim
  - Generate ZK proof
  - Submit to contract
  - Verify resolution

- [ ] **Sprint 1 Review**
  - Document all deployed contracts
  - Test coverage report
  - Performance metrics
  - Update GitHub

**Deliverable**: Fully functional backend + ZK system
**Budget Day 7**: $10
**Sprint 1 Total Spend**: ~$270
**Remaining**: $230

---

## 📋 SPRINT 2 (Days 8-14): FRONTEND & LAUNCH

### Day 8 (Monday): Frontend Foundation
**Goal**: Setup Next.js app with wallet integration

#### Morning (4 hours):
- [ ] **Create Next.js app**
  ```bash
  npx create-next-app@latest eon-app --typescript --tailwind --app
  cd eon-app

  # Install dependencies
  npm install wagmi viem @privy-io/react-auth
  npm install @tanstack/react-query zustand
  npm install recharts lucide-react
  npm install @rainbow-me/rainbowkit
  ```

- [ ] **Setup Wagmi + Privy**
  ```typescript
  // app/providers.tsx
  import { WagmiProvider } from 'wagmi';
  import { PrivyProvider } from '@privy-io/react-auth';

  // Configure chains (Arbitrum Sepolia, Base Sepolia)
  // Setup wallet connectors
  ```

#### Afternoon (4 hours):
- [ ] **Build landing page** (/)
  - Hero section: "Time as Collateral"
  - Value props: Permissionless credit, ZK privacy, Cross-chain
  - CTA: "Connect Wallet"
  - Footer: Links, socials

- [ ] **Navigation & layout**
  - Top nav: Logo, Dashboard, Borrow, Lend, Governance
  - Mobile responsive
  - Dark mode

**Deliverable**: Basic app shell with wallet connection
**Budget Day 8**: $0

---

### Day 9 (Tuesday): Dashboard UI
**Goal**: Build user dashboard showing reputation

#### Morning (4 hours):
- [ ] **Reputation display**
  ```typescript
  // app/dashboard/page.tsx
  - Fetch user reputation from GraphQL
  - Display score (0-1000) with visualization
  - Show age (months), decay status
  - Active claims list
  - Loan history
  ```

- [ ] **Charts & visualizations**
  - Reputation score gauge (Recharts)
  - Timeline of claims
  - Borrow/repay history

#### Afternoon (4 hours):
- [ ] **Connect to backend**
  ```typescript
  import { useQuery } from '@tanstack/react-query';

  const { data: reputation } = useQuery({
      queryKey: ['reputation', address],
      queryFn: () => gqlClient.query({
          query: GET_REPUTATION,
          variables: { user: address }
      })
  });
  ```

- [ ] **Real-time updates**
  - WebSocket subscriptions for claim status
  - Toast notifications for events

**Deliverable**: Working dashboard showing user data
**Budget Day 9**: $0

---

### Day 10 (Wednesday): Claim Submission Flow
**Goal**: Build UI for submitting temporal ownership claims

#### Morning (4 hours):
- [ ] **Claim form UI** (/app/claim)
  ```typescript
  - Date range picker (start/end dates)
  - Minimum balance input (ETH/WETH)
  - Auto-calculate: duration, samples needed
  - Display: estimated gas, proof generation time
  - Submit button
  ```

- [ ] **ZK proof generation**
  ```typescript
  // In browser using WASM
  import { groth16 } from 'snarkjs';

  async function handleSubmit() {
      // 1. Fetch historical balances from indexer
      const balances = await fetchBalances(startDate, endDate);

      // 2. Build merkle tree
      const merkleTree = buildTree(balances);

      // 3. Generate ZK proof (show progress bar)
      const proof = await groth16.fullProve({...}, wasm, zkey);

      // 4. Submit to contract
      await claimManager.submitClaim(minBalance, startBlock, endBlock, proof);
  }
  ```

#### Afternoon (4 hours):
- [ ] **Progress tracking**
  - Step 1: Fetching data
  - Step 2: Building merkle tree
  - Step 3: Generating proof (30s-2min)
  - Step 4: Submitting transaction
  - Step 5: Confirmation

- [ ] **Error handling**
  - Insufficient balance detected
  - Proof generation failed
  - Transaction reverted
  - Network issues

**Deliverable**: Working claim submission with ZK proofs
**Budget Day 10**: $20 (testing gas)

---

### Day 11 (Thursday): Lending Interface
**Goal**: Build borrow and lend UIs

#### Morning (4 hours):
- [ ] **Pool selection UI** (/app/borrow)
  ```typescript
  // Display 3 pools: Conservative, Growth, Degen
  - Pool APR (dynamic based on utilization)
  - Your LTV (based on reputation)
  - Available liquidity
  - TVL, borrowers count
  - "Borrow" button for each
  ```

- [ ] **Borrow flow**
  ```typescript
  - Collateral input (WETH amount)
  - Auto-calculate max borrow (based on LTV)
  - Borrow amount input
  - Display: APR, repayment amount, liquidation price
  - Approve + Borrow transactions
  ```

#### Afternoon (4 hours):
- [ ] **LP interface** (/app/lend)
  ```typescript
  - Deposit to pool (USDC)
  - See your shares
  - Calculate APY (base + utilization bonus)
  - Withdraw interface
  - Earnings tracker
  ```

- [ ] **Loan management**
  - Active loans list
  - Repay loan button
  - Health factor display
  - Liquidation warning if underwater

**Deliverable**: Complete borrow/lend functionality
**Budget Day 11**: $30 (testing)

---

### Day 12 (Friday): Governance + Polish
**Goal**: Add governance UI and polish UX

#### Morning (4 hours):
- [ ] **Governance UI** (/app/governance)
  ```typescript
  - Active proposals list
  - Proposal details page
  - Vote buttons (For/Against/Abstain)
  - Your voting power display
  - Create proposal form (social recovery, parameter changes)
  ```

- [ ] **Social recovery flow**
  ```typescript
  - Search slashed user
  - Write justification
  - Create proposal
  - Vote tracking
  - Execution when passed
  ```

#### Afternoon (4 hours):
- [ ] **UX polish**
  - Loading states everywhere
  - Skeleton screens
  - Error boundaries
  - Toast notifications (react-hot-toast)
  - Animations (framer-motion)

- [ ] **Mobile optimization**
  - Responsive breakpoints
  - Touch-friendly buttons
  - Mobile wallet support

**Deliverable**: Complete frontend with governance
**Budget Day 12**: $0

---

### Day 13 (Saturday): Testing & Docs
**Goal**: Comprehensive testing and documentation

#### Morning (4 hours):
- [ ] **E2E testing**
  ```bash
  # User journey tests
  1. Connect wallet
  2. Submit claim
  3. Wait for acceptance
  4. Borrow against reputation
  5. Repay loan
  6. Withdraw collateral
  ```

- [ ] **Load testing**
  - K6 scripts for API
  - Simulate 100 concurrent users
  - Measure response times
  - Identify bottlenecks

#### Afternoon (4 hours):
- [ ] **Documentation**
  ```markdown
  # Create in /docs
  - README.md (overview, quick start)
  - ARCHITECTURE.md (tech stack, diagrams)
  - API.md (GraphQL schema, endpoints)
  - USER_GUIDE.md (how to use the app)
  - DEVELOPER.md (local setup, contributing)
  ```

- [ ] **Video demo**
  - Record 3-min demo using Loom
  - Show: claim submission, borrowing, repayment
  - Upload to YouTube

**Deliverable**: Tested app with full documentation
**Budget Day 13**: $0

---

### Day 14 (Sunday): Launch Prep & Deployment
**Goal**: Deploy to production and prepare for launch

#### Morning (4 hours):
- [ ] **Production deployment**
  ```bash
  # Frontend: Vercel
  vercel --prod
  # Custom domain: app.eonprotocol.com

  # Backend: AWS ECS or Railway
  railway up
  # API: api.eonprotocol.com

  # Database: Supabase or Railway Postgres
  ```

- [ ] **Monitoring setup**
  - Sentry for error tracking
  - PostHog for analytics
  - Grafana for metrics
  - Status page (statuspage.io free tier)

#### Afternoon (4 hours):
- [ ] **Launch checklist**
  - [ ] All contracts verified on explorer
  - [ ] Subgraph deployed and synced
  - [ ] Frontend live on custom domain
  - [ ] API responding correctly
  - [ ] Monitoring active
  - [ ] Security: rate limits, CORS, CSP headers

- [ ] **Marketing prep**
  - Twitter announcement thread drafted
  - Product Hunt launch scheduled
  - Crypto Twitter influencer DMs
  - Reddit posts prepared (r/ethfinance, r/defi)
  - Discord announcement

**Deliverable**: LIVE PRODUCTION APP 🚀
**Budget Day 14**: $50 (Vercel/Railway Pro for month)
**Sprint 2 Total Spend**: ~$100
**TOTAL 2-WEEK SPEND**: ~$370

---

## 📊 SUCCESS METRICS (End of Sprint 2)

### Technical Metrics:
- ✅ Smart contracts deployed on 2 chains (Arbitrum + Base)
- ✅ 100% test coverage on critical paths
- ✅ <200ms API response time p95
- ✅ ZK proof generation <2min
- ✅ Indexer 99%+ uptime
- ✅ Frontend Lighthouse score >90

### Business Metrics:
- 🎯 10 beta users testing on testnet
- 🎯 5 successful claims processed
- 🎯 $10K test TVL in pools
- 🎯 0 critical bugs
- 🎯 Documentation complete

### Launch Metrics (Week 3):
- 🚀 Product Hunt launch
- 🚀 100 Twitter followers
- 🚀 50 Discord members
- 🚀 Grant applications submitted (EF, Arbitrum)

---

## 💰 FUNDING STRATEGY (Post-Sprint)

### Week 3-4: Grant Applications ($100K+ target)

#### Ethereum Foundation ($30K-100K)
```
Application: https://esp.ethereum.foundation
Focus: "ZK-based temporal reputation primitive"
Timeline: 4-8 weeks
Probability: 60% (novel ZK use case)
```

#### Arbitrum Foundation ($50K-100K)
```
Application: https://arbitrum.foundation/grants
Focus: "Native Arbitrum DeFi primitive"
Timeline: 6-12 weeks
Probability: 70% (deploying on Arbitrum)
```

#### ZK Grants Round ($10K-30K)
```
Application: https://esp.ethereum.foundation/zk-grants
Focus: "Temporal ownership ZK circuits"
Timeline: Rolling
Probability: 80% (perfect fit)
```

#### Total Expected: $90K-230K over 3 months

### Month 3-4: Accelerators
- Alliance DAO (apply with MVP)
- a16z CSX (application open Q2)
- Binance Labs (post-traction)

### Month 5+: Seed Round ($3-5M target)
- Lead: Paradigm, Variant, 1kx (DeFi specialists)
- Signal: Coinbase Ventures, Polygon Ventures
- Angels: Stani Kulechov (Aave), Kain Warwick (Synthetix)

---

## 🎯 DAILY STANDUP FORMAT

Each day at 9am:
```
Yesterday:
- [What you completed]

Today:
- [What you'll complete]

Blockers:
- [Any issues]

Budget:
- [Spent today / Remaining]
```

Track in: Notion or Linear (free tier)

---

## 🔥 RISK MITIGATION

### Technical Risks:
| Risk | Mitigation | Owner |
|------|-----------|-------|
| ZK circuit bug | Extensive test vectors, zkSecurity review later | You |
| Indexer downtime | Checkpoint system, automatic restarts | You |
| Contract bug | Slither audit, testnet battle-testing | You |

### Timeline Risks:
| Risk | Mitigation |
|------|-----------|
| ZK proof too slow | Use precomputed proofs for demo, optimize later |
| Frontend complexity | Use shadcn/ui templates, no custom design |
| Deployment issues | Test deployments on Day 2, not Day 14 |

---

## 🏆 DEFINITION OF DONE

Sprint is complete when:
- ✅ Live on Arbitrum Sepolia + Base Sepolia
- ✅ Working frontend at app.eonprotocol.com
- ✅ 10 beta users successfully tested
- ✅ Full documentation published
- ✅ Grant applications submitted
- ✅ Tweet announcing launch posted

---

## 📝 AFTER SPRINT 2 (Weeks 3-8)

### Week 3-4: Beta Testing & Iteration
- Fix bugs found by beta users
- Optimize gas costs
- Improve UX based on feedback

### Week 5-6: Security Prep
- Internal audit (Slither, Aderyn, Mythril)
- Code4rena contest ($50K prize pool)
- Prepare for professional audits

### Week 7-8: Audit & Mainnet
- Trail of Bits audit (4 weeks, $100K)
- Fix audit findings
- Deploy to mainnet
- Marketing campaign

---

## 🚀 LET'S FUCKING BUILD THIS

**This plan is EXECUTABLE. This is REAL. You can do this in 14 days.**

**Track progress in**: `/tmp/sprint-tracker.md` (create daily)

**Start Monday. Ship Sunday. Build the future of on-chain credit.** ⚡

---

*"The best time to plant a tree was 20 years ago. The second best time is now."*

**EON PROTOCOL - TIME AS COLLATERAL** 🌟
