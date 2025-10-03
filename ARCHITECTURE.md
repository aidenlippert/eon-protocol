# Eon Protocol Architecture - Data Storage & Decentralization Strategy

## Current State (MVP - Client-Side Only)
- ✅ Credit scores calculated client-side
- ✅ Data stored in localStorage (browser only)
- ❌ No persistence across devices
- ❌ No on-chain verification
- ❌ Not production-ready

## Problem: How to Store Credit Scores Decentrally?

We have **three architectural approaches**, each with different tradeoffs:

---

## Option 1: Hybrid (Recommended for Launch) ⭐

**Architecture:**
```
User Wallet → Frontend → Supabase/PostgreSQL → Smart Contract (verification)
                            ↓
                    Signed attestations stored on-chain
```

**How It Works:**
1. User connects wallet and calculates score client-side
2. Backend API verifies calculation is legitimate (re-runs analysis)
3. Store full score details in centralized DB (fast reads)
4. Store merkle root + signature on-chain (cheap verification)
5. Users can prove their score with cryptographic proof

**Pros:**
- ✅ Fast: Instant score retrieval from database
- ✅ Cheap: Only merkle roots on-chain (~$0.01 per update)
- ✅ Upgradeable: Can improve scoring algorithm without migration
- ✅ Privacy: Detailed data off-chain, only hash on-chain
- ✅ Works today: Can launch immediately

**Cons:**
- ⚠️ Centralization risk: Database can go down
- ⚠️ Trust assumption: Users trust backend calculates correctly
- ⚠️ Censorship: Backend could block users

**Implementation:**
```typescript
// Backend API (Next.js API routes)
POST /api/scores/calculate
  1. Verify wallet signature
  2. Re-calculate score from on-chain data
  3. Store in Supabase: { wallet, score, breakdown, timestamp }
  4. Generate merkle proof
  5. Call smart contract: recordScore(merkleRoot, signature)

GET /api/scores/:wallet
  1. Return cached score from database
  2. Return on-chain verification proof

// Smart Contract (Solidity)
contract CreditRegistry {
  mapping(address => bytes32) public scoreMerkleRoots;

  function recordScore(bytes32 merkleRoot, bytes signature) external {
    require(verifySignature(msg.sender, merkleRoot, signature));
    scoreMerkleRoots[msg.sender] = merkleRoot;
  }
}
```

**Database Schema (Supabase):**
```sql
CREATE TABLE credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  breakdown JSONB NOT NULL,
  merkle_root TEXT,
  on_chain_signature TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address)
);

CREATE INDEX idx_wallet ON credit_scores(wallet_address);
CREATE INDEX idx_score ON credit_scores(score DESC);
```

---

## Option 2: Fully On-Chain (Most Decentralized)

**Architecture:**
```
User Wallet → Smart Contract → On-Chain Storage
                    ↓
            Credit Score NFT (ERC-721)
```

**How It Works:**
1. User submits proof of transactions to smart contract
2. Contract calculates score on-chain (expensive!)
3. Mint Credit Score NFT with metadata
4. Score updates require new proof submission

**Pros:**
- ✅ Fully decentralized: No backend needed
- ✅ Censorship resistant: Cannot be shut down
- ✅ Transparent: All logic visible on-chain
- ✅ Composable: Other protocols can read scores

**Cons:**
- ❌ Extremely expensive: ~$50-200 per score calculation
- ❌ Slow: Block confirmation times
- ❌ Limited computation: Can't analyze thousands of transactions
- ❌ Static: Hard to upgrade scoring algorithm

**Implementation:**
```solidity
contract CreditScoreNFT is ERC721 {
  struct Score {
    uint256 value;
    uint256 lastUpdate;
    bytes32[] proofHashes; // Transaction proofs
  }

  mapping(uint256 => Score) public scores;

  function calculateScore(bytes32[] calldata proofHashes) external {
    // Verify merkle proofs for transactions
    // Calculate score on-chain (limited complexity)
    // Mint/update NFT
  }
}
```

---

## Option 3: Decentralized Storage (IPFS + ENS)

**Architecture:**
```
User Wallet → Frontend → IPFS (store score JSON)
                            ↓
                    ENS record points to IPFS hash
```

**How It Works:**
1. Calculate score client-side
2. Upload score JSON to IPFS (get hash)
3. Store IPFS hash in ENS text record for wallet
4. Anyone can read score from IPFS via ENS lookup

**Pros:**
- ✅ Decentralized storage: Data on IPFS network
- ✅ Cheap: Only gas for ENS update (~$5-10)
- ✅ Readable: Other dApps can fetch scores
- ✅ No backend: Fully client-side

**Cons:**
- ⚠️ Trust: No verification score is accurate
- ⚠️ Requires ENS: Not all wallets have ENS names
- ⚠️ IPFS reliability: Data could become unavailable
- ⚠️ Self-reported: Users could fake scores

**Implementation:**
```typescript
// Upload to IPFS
const scoreData = { wallet, score, breakdown, timestamp };
const ipfsHash = await ipfs.add(JSON.stringify(scoreData));

// Store in ENS
const ensContract = new Contract(ENS_ADDRESS, ENS_ABI, signer);
await ensContract.setText(
  namehash('yourname.eth'),
  'eon-credit-score',
  ipfsHash
);

// Read score
const hash = await ensContract.text(namehash('wallet.eth'), 'eon-credit-score');
const scoreData = await ipfs.cat(hash);
```

---

## Recommended Path Forward: Hybrid Approach (Option 1)

### Phase 1: MVP (Current) - 2 weeks
- ✅ Client-side calculation
- ✅ localStorage persistence
- ✅ Test with small user base

### Phase 2: Backend + Database - 2 weeks
- [ ] Set up Supabase (free tier: 500MB, 2 CPU)
- [ ] Create Next.js API routes for score calculation
- [ ] Implement wallet signature verification
- [ ] Store scores in PostgreSQL
- [ ] Add caching layer (Redis optional)

### Phase 3: On-Chain Verification - 2 weeks
- [ ] Deploy `CreditRegistry` smart contract
- [ ] Implement merkle proof generation
- [ ] Store merkle roots on-chain
- [ ] Add proof verification UI

### Phase 4: Decentralization (Future)
- [ ] Add IPFS backup storage
- [ ] Multi-region database replication
- [ ] Open-source backend for self-hosting
- [ ] DAO governance for scoring algorithm

---

## Smart Contract Architecture

```solidity
// contracts/CreditRegistry.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract CreditRegistry is Ownable {
    using ECDSA for bytes32;

    struct CreditScore {
        uint16 score;           // 300-850
        uint8 tier;             // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum
        uint32 lastUpdate;      // Timestamp
        bytes32 merkleRoot;     // Root of score breakdown merkle tree
    }

    mapping(address => CreditScore) public scores;
    mapping(address => bool) public authorizedCalculators; // Backend addresses

    event ScoreUpdated(address indexed wallet, uint16 score, uint8 tier);

    function updateScore(
        address wallet,
        uint16 score,
        uint8 tier,
        bytes32 merkleRoot,
        bytes calldata signature
    ) external {
        require(authorizedCalculators[msg.sender], "Unauthorized");
        require(score >= 300 && score <= 850, "Invalid score");
        require(tier <= 3, "Invalid tier");

        // Verify signature from wallet owner
        bytes32 message = keccak256(abi.encodePacked(wallet, score, tier, merkleRoot));
        address signer = message.toEthSignedMessageHash().recover(signature);
        require(signer == wallet, "Invalid signature");

        scores[wallet] = CreditScore({
            score: score,
            tier: tier,
            lastUpdate: uint32(block.timestamp),
            merkleRoot: merkleRoot
        });

        emit ScoreUpdated(wallet, score, tier);
    }

    function getScore(address wallet) external view returns (uint16, uint8, uint32) {
        CreditScore memory s = scores[wallet];
        return (s.score, s.tier, s.lastUpdate);
    }

    function addAuthorizedCalculator(address calculator) external onlyOwner {
        authorizedCalculators[calculator] = true;
    }
}
```

---

## Backend API Structure

```
/tmp/eon-frontend/
├── app/
│   └── api/
│       ├── scores/
│       │   ├── calculate/route.ts      # POST - Calculate and store score
│       │   ├── [wallet]/route.ts       # GET - Retrieve score
│       │   └── verify/route.ts         # POST - Verify merkle proof
│       └── kyc/
│           └── ... (existing)
├── lib/
│   ├── supabase.ts                     # Database client
│   ├── merkle.ts                       # Merkle tree generation
│   └── signature.ts                    # Wallet signature verification
└── contracts/
    ├── CreditRegistry.sol              # Main score registry
    └── scripts/
        └── deploy.ts                   # Deployment script
```

---

## Cost Analysis

### Option 1: Hybrid (Recommended)
- **Database:** $0-25/month (Supabase free → pro)
- **On-chain storage:** ~$0.01 per score update
- **API hosting:** $0 (Vercel free tier)
- **Total for 1000 users:** ~$35/month

### Option 2: Fully On-Chain
- **Score calculation:** $50-200 per user
- **Score update:** $50-200 per update
- **Total for 1000 users:** $50,000-200,000 😱

### Option 3: IPFS + ENS
- **IPFS pinning:** $5-20/month (Pinata/Infura)
- **ENS updates:** $5-10 per user one-time
- **Total for 1000 users:** ~$5,020/month

---

## Security Considerations

### Backend Security
- ✅ Rate limiting on API endpoints
- ✅ Wallet signature verification
- ✅ DDoS protection (Cloudflare)
- ✅ Database encryption at rest
- ✅ No private keys stored
- ✅ Open-source backend code for audits

### Smart Contract Security
- ✅ Authorized calculator addresses only
- ✅ Signature verification for score updates
- ✅ Merkle proofs for data integrity
- ✅ Time-based score expiration
- ✅ Emergency pause functionality

---

## Next Steps (Your Action Items)

1. **Decide on approach:** Hybrid (recommended) or fully on-chain?

2. **Set up infrastructure:**
   ```bash
   # Create Supabase project
   # Get API keys
   # Set up environment variables
   ```

3. **Deploy smart contract:**
   ```bash
   cd /tmp/eon-protocol
   npx hardhat compile
   npx hardhat run scripts/deploy-credit-registry.ts --network arbitrumSepolia
   ```

4. **Build backend API:**
   - Implement `/api/scores/calculate`
   - Implement `/api/scores/[wallet]`
   - Add signature verification

5. **Update frontend:**
   - Remove localStorage (or use as cache)
   - Call backend API instead
   - Show on-chain verification status

---

## Questions to Answer

1. **How much decentralization do you need?**
   - Full: Go with Option 2 (expensive but pure)
   - Balanced: Go with Option 1 (recommended)
   - Minimal: Keep current localStorage approach

2. **What's your budget?**
   - $0/month: Stay with localStorage
   - $25/month: Supabase + on-chain verification
   - $100+/month: Consider custom infrastructure

3. **How soon do you need this live?**
   - 1 week: Keep localStorage, add backend later
   - 2-3 weeks: Implement Hybrid approach
   - 1+ months: Consider fully on-chain

4. **Do you need to prove scores to other protocols?**
   - Yes: On-chain storage is critical
   - No: Centralized DB is fine for now

---

## My Recommendation

**Start with Hybrid (Option 1) in 3 phases:**

**Week 1-2:** Build backend API + Supabase
- Fast to implement
- Low cost ($0-25/month)
- Can scale to thousands of users
- Users get persistent scores

**Week 3-4:** Add smart contract verification
- Deploy `CreditRegistry.sol`
- Store merkle roots on-chain
- Add proof verification UI
- Enables composability

**Month 2+:** Progressive decentralization
- Open-source backend
- Add IPFS backup
- Implement DAO governance
- Consider L2 rollup for cheaper storage

This gives you a **production-ready system in 2 weeks** with a clear path to full decentralization.

Want me to start implementing the backend + Supabase integration?
