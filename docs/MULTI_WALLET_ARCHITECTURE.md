# Multi-Wallet & Cross-Chain Architecture

## Problem Statement

You asked the critical questions:
1. **Why different scores?** - API vs blockchain calculations
2. **How to use multiple wallets to show average data?** - Aggregating scores
3. **How to limit one wallet per user?** - Sybil resistance
4. **How to create a user database?** - Identity management
5. **How to score across multiple wallets and chains?** - Cross-chain credit

---

## 1. Current Architecture (Single Wallet)

### What We Have Now

```
User connects wallet → ScoreOraclePhase3B.computeScore(address) → Score (0-100)
```

**Pros:**
- ✅ Simple, on-chain, permissionless
- ✅ No off-chain database required
- ✅ Truly decentralized

**Cons:**
- ❌ Each wallet scored independently
- ❌ No way to link wallets to same person
- ❌ Easy to game by creating multiple wallets

---

## 2. Solution: KYC-Linked Multi-Wallet System

### Architecture Overview

```
User (Real Person)
  ↓
KYC Verification (Didit)
  ↓
Primary Wallet (registered)
  ↓
Linked Wallets (optional, up to 5)
  ↓
Aggregate Credit Score
```

### Smart Contract: `UserRegistry.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract UserRegistry {
    struct User {
        bytes32 kycHash;           // Hash of KYC ID (privacy)
        address primaryWallet;      // Main wallet
        address[] linkedWallets;    // Additional wallets
        uint40 registeredAt;
        bool exists;
    }

    // KYC hash → User
    mapping(bytes32 => User) public users;

    // Wallet → KYC hash (reverse lookup)
    mapping(address => bytes32) public walletToKycHash;

    // Prevent multiple users per KYC
    mapping(bytes32 => bool) public kycHashUsed;

    uint8 public constant MAX_LINKED_WALLETS = 5;

    error AlreadyRegistered();
    error MaxWalletsReached();
    error NotYourWallet();
    error KYCAlreadyUsed();

    event UserRegistered(bytes32 indexed kycHash, address indexed primaryWallet);
    event WalletLinked(bytes32 indexed kycHash, address indexed wallet);
    event WalletUnlinked(bytes32 indexed kycHash, address indexed wallet);

    /**
     * @notice Register a new user with KYC
     * @param kycHash Hash of KYC verification ID (from Didit)
     */
    function registerUser(bytes32 kycHash) external {
        if (kycHashUsed[kycHash]) revert KYCAlreadyUsed();
        if (walletToKycHash[msg.sender] != bytes32(0)) revert AlreadyRegistered();

        User storage user = users[kycHash];
        user.kycHash = kycHash;
        user.primaryWallet = msg.sender;
        user.registeredAt = uint40(block.timestamp);
        user.exists = true;

        walletToKycHash[msg.sender] = kycHash;
        kycHashUsed[kycHash] = true;

        emit UserRegistered(kycHash, msg.sender);
    }

    /**
     * @notice Link additional wallet to your account
     * @param wallet Address to link
     */
    function linkWallet(address wallet) external {
        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) revert NotYourWallet();

        User storage user = users[kycHash];
        if (user.linkedWallets.length >= MAX_LINKED_WALLETS) revert MaxWalletsReached();
        if (walletToKycHash[wallet] != bytes32(0)) revert AlreadyRegistered();

        user.linkedWallets.push(wallet);
        walletToKycHash[wallet] = kycHash;

        emit WalletLinked(kycHash, wallet);
    }

    /**
     * @notice Get all wallets for a user
     */
    function getUserWallets(bytes32 kycHash) external view returns (address primary, address[] memory linked) {
        User storage user = users[kycHash];
        return (user.primaryWallet, user.linkedWallets);
    }

    /**
     * @notice Get all wallets for caller
     */
    function getMyWallets() external view returns (address primary, address[] memory linked) {
        bytes32 kycHash = walletToKycHash[msg.sender];
        if (kycHash == bytes32(0)) return (address(0), new address[](0));

        User storage user = users[kycHash];
        return (user.primaryWallet, user.linkedWallets);
    }
}
```

### Updated `ScoreOraclePhase3B_V2.sol`

```solidity
import "./UserRegistry.sol";

contract ScoreOraclePhase3B_V2 {
    UserRegistry public userRegistry;

    /**
     * @notice Compute aggregate score across all user's wallets
     * @param wallet Any wallet owned by the user
     */
    function computeAggregateScore(address wallet) external view returns (ScoreBreakdown memory) {
        bytes32 kycHash = userRegistry.walletToKycHash(wallet);
        if (kycHash == bytes32(0)) {
            // No registered user, score single wallet
            return _computeSingleWalletScore(wallet);
        }

        // Get all user's wallets
        (address primary, address[] memory linked) = userRegistry.getUserWallets(kycHash);

        // Aggregate data across all wallets
        uint256 totalS1 = 0;
        uint256 totalS2 = 0;
        uint256 totalS3 = 0;
        uint256 totalS4 = 0;
        uint256 totalS5 = 0;
        uint256 walletCount = 1 + linked.length;

        // Score primary wallet
        ScoreBreakdown memory primaryScore = _computeSingleWalletScore(primary);
        totalS1 += primaryScore.s1_repayment;
        totalS2 += primaryScore.s2_collateral;
        totalS3 += uint256(int256(primaryScore.s3_raw));
        totalS4 += primaryScore.s4_crossChain;
        totalS5 += primaryScore.s5_governance;

        // Score linked wallets
        for (uint256 i = 0; i < linked.length; i++) {
            ScoreBreakdown memory linkedScore = _computeSingleWalletScore(linked[i]);
            totalS1 += linkedScore.s1_repayment;
            totalS2 += linkedScore.s2_collateral;
            totalS3 += uint256(int256(linkedScore.s3_raw));
            totalS4 += linkedScore.s4_crossChain;
            totalS5 += linkedScore.s5_governance;
        }

        // Average scores
        uint8 avgS1 = uint8(totalS1 / walletCount);
        uint8 avgS2 = uint8(totalS2 / walletCount);
        int16 avgS3Raw = int16(int256(totalS3 / walletCount));
        uint8 avgS3 = _normalizeS3(avgS3Raw);
        uint8 avgS4 = uint8(totalS4 / walletCount);
        uint8 avgS5 = uint8(totalS5 / walletCount);

        // Weighted average
        uint256 weighted = (
            (uint256(avgS1) * 40) +
            (uint256(avgS2) * 20) +
            (uint256(avgS3) * 20) +
            (uint256(avgS4) * 10) +
            (uint256(avgS5) * 10)
        ) / 100;

        return ScoreBreakdown({
            overall: uint16(weighted),
            s1_repayment: avgS1,
            s2_collateral: avgS2,
            s3_sybil: avgS3,
            s4_crossChain: avgS4,
            s5_governance: avgS5,
            s3_raw: avgS3Raw
        });
    }

    function _computeSingleWalletScore(address wallet) internal view returns (ScoreBreakdown memory) {
        // Existing single-wallet scoring logic
        // ...
    }
}
```

---

## 3. Cross-Chain Scoring (Already Implemented!)

### Current Implementation

The `ScoreOraclePhase3B` **already supports cross-chain scoring** via Factor S4:

```solidity
// S4: Cross-Chain Reputation (10% weight)
function _scoreCrossChainReputation(address subject) internal view returns (uint8) {
    uint256 chainCount = 0;
    uint256 totalCrossChainScore = 0;

    // Aggregate scores from other chains
    for (uint256 i = 0; i < supportedChainSelectors.length; i++) {
        uint64 chainSelector = supportedChainSelectors[i];
        CrossChainScore memory crossScore = registry.getCrossChainScore(subject, chainSelector);

        if (crossScore.updatedAt > 0) {
            chainCount++;
            totalCrossChainScore += crossScore.overallScore;
        }
    }

    // Average cross-chain score + bonus for multi-chain presence
    // ...
}
```

### Supported Chains

Already configured in constructor:
- **Arbitrum Sepolia**: `3478487238524512106`
- **Optimism Sepolia**: `5224473277236331295`
- **Base Sepolia**: `10344971235874465080`

### How It Works

1. **CreditRegistryV3** stores cross-chain scores:
```solidity
mapping(address => mapping(uint64 => CrossChainScore)) public crossChainScores;

struct CrossChainScore {
    uint64 chainSelector;
    uint16 overallScore;
    uint40 updatedAt;
}
```

2. **Chainlink CCIP** syncs scores across chains (to be implemented)
3. **ScoreOracle** aggregates all chain scores into S4 factor

---

## 4. Database Architecture (Off-Chain)

### Supabase Schema

```sql
-- Users table (KYC-linked)
CREATE TABLE users (
    kyc_hash TEXT PRIMARY KEY,
    primary_wallet TEXT NOT NULL,
    linked_wallets TEXT[], -- Array of linked wallet addresses
    didit_session_id TEXT,
    registered_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet metadata
CREATE TABLE wallets (
    address TEXT PRIMARY KEY,
    kyc_hash TEXT REFERENCES users(kyc_hash),
    is_primary BOOLEAN DEFAULT false,
    first_seen TIMESTAMP,
    last_active TIMESTAMP
);

-- Score history (for charts)
CREATE TABLE score_history (
    id BIGSERIAL PRIMARY KEY,
    kyc_hash TEXT REFERENCES users(kyc_hash),
    wallet TEXT,
    score INTEGER NOT NULL,
    tier TEXT,
    s1_repayment INTEGER,
    s2_collateral INTEGER,
    s3_sybil INTEGER,
    s4_cross_chain INTEGER,
    s5_governance INTEGER,
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- Cross-chain activity
CREATE TABLE cross_chain_activity (
    id BIGSERIAL PRIMARY KEY,
    wallet TEXT NOT NULL,
    source_chain TEXT,
    destination_chain TEXT,
    transaction_hash TEXT,
    timestamp TIMESTAMP
);

-- Indexes
CREATE INDEX idx_wallets_kyc ON wallets(kyc_hash);
CREATE INDEX idx_score_history_kyc ON score_history(kyc_hash);
CREATE INDEX idx_score_history_time ON score_history(calculated_at DESC);
```

---

## 5. Frontend Implementation

### Multi-Wallet UI Flow

```typescript
// 1. User connects wallet and completes KYC
const handleKYCComplete = async (kycHash: string) => {
  // Register user on-chain
  const tx = await userRegistry.registerUser(kycHash);
  await tx.wait();

  // Store in Supabase
  await supabase.from('users').insert({
    kyc_hash: kycHash,
    primary_wallet: address,
  });
};

// 2. User links additional wallets
const handleLinkWallet = async (newWallet: string) => {
  const tx = await userRegistry.linkWallet(newWallet);
  await tx.wait();

  // Update Supabase
  await supabase.from('wallets').insert({
    address: newWallet,
    kyc_hash: kycHash,
    is_primary: false,
  });
};

// 3. Fetch aggregate score
const { score, tier } = useAggregateScore(address);
```

---

## 6. Implementation Roadmap

### Phase 1: Single Wallet (DONE ✅)
- [x] ScoreOraclePhase3B deployed
- [x] Frontend shows real blockchain scores
- [x] 5-factor scoring working

### Phase 2: Multi-Wallet (TODO)
- [ ] Deploy `UserRegistry.sol`
- [ ] Update `ScoreOraclePhase3B_V2` with aggregate scoring
- [ ] Frontend: Wallet linking UI
- [ ] Supabase: Multi-wallet schema

### Phase 3: Cross-Chain (TODO)
- [ ] Implement Chainlink CCIP message passing
- [ ] Deploy contracts on Optimism Sepolia
- [ ] Deploy contracts on Base Sepolia
- [ ] Cross-chain score synchronization

### Phase 4: Advanced Features (TODO)
- [ ] Credit delegation (use someone else's score)
- [ ] Social graph scoring (connections boost score)
- [ ] Historical score replay (time-travel scoring)
- [ ] Privacy-preserving ZK proofs for KYC

---

## 7. Security Considerations

### Sybil Resistance

1. **KYC Requirement**: One person = one KYC = one account
2. **Wallet Limits**: Max 5 linked wallets per user
3. **Economic Cost**: Linking wallets costs gas (spam prevention)
4. **Behavioral Analysis**: Detect wallet farming patterns

### Privacy

1. **KYC Hash**: Store `keccak256(kycId)` on-chain, not raw ID
2. **Zero-Knowledge**: Use ZK proofs for KYC verification without revealing identity
3. **Wallet Anonymity**: Linked wallets remain pseudonymous
4. **Off-Chain Metadata**: Sensitive data in encrypted Supabase

### Attack Vectors

| Attack | Mitigation |
|--------|------------|
| Multiple KYC accounts | Didit fraud detection |
| Wallet washing (transfer between own wallets) | Time delays, activity analysis |
| Cross-chain gaming | Synchronized scoring, CCIP verification |
| Score manipulation | Weighted factors, multiple data sources |

---

## 8. Alternative Approaches

### Option A: Single Wallet (Current)
**Pros**: Simple, decentralized, no KYC required
**Cons**: Easy to game with multiple wallets

### Option B: KYC-Linked Multi-Wallet (Recommended)
**Pros**: Sybil resistant, better UX, accurate scoring
**Cons**: Requires KYC, centralization risk

### Option C: Social Graph Scoring
**Pros**: No KYC, uses on-chain social connections
**Cons**: Complex, requires large network effects

### Option D: ZK-Powered Identity
**Pros**: Privacy-preserving, no centralized KYC
**Cons**: Bleeding edge tech, high complexity

---

## Conclusion

Your questions reveal the **core challenge of DeFi credit scoring**: balancing decentralization, privacy, and Sybil resistance.

**Recommended Path**:
1. ✅ **Keep current single-wallet system** for MVP
2. 🚀 **Add KYC-linked multi-wallet** for power users
3. 🌍 **Enable cross-chain via CCIP** for S4 factor
4. 🔮 **Explore ZK proofs** for future privacy

The architecture is designed to support ALL approaches simultaneously - users can choose their level of identity verification vs. privacy.
