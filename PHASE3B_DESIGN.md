# Phase 3B Design - Complete Credit Scoring System

**Objective**: Implement S2, S4, S5 and enhance S3 with full KYC integration for a comprehensive 5-factor credit score.

## Score Component Breakdown

### S1 - Repayment History (40% weight) ✅ IMPLEMENTED
**Status**: Fully functional in Phase 3 Incremental

**Formula**: `(repaid/total * 100) - (liquidations * 20)`

**Range**: 0-100

---

## S2 - Collateral Utilization (20% weight) 🆕

### Objective
Reward conservative borrowing behavior and healthy collateralization ratios.

### Metrics Tracked
1. **Average Collateralization Ratio**: Total collateral value / Total borrowed across all active loans
2. **Max LTV Frequency**: % of loans borrowed at maximum allowed LTV
3. **Collateral Diversity**: Number of different collateral asset types used

### Scoring Algorithm

```typescript
function calculateS2(user: address): uint8 {
  // 1. Calculate average collateralization ratio
  let totalCollateralUsd = 0;
  let totalBorrowedUsd = 0;
  let maxLtvCount = 0;
  let uniqueAssets = new Set();

  for (loan of user.loans) {
    totalCollateralUsd += loan.collateralValue;
    totalBorrowedUsd += loan.principal;
    uniqueAssets.add(loan.collateralToken);

    // Check if borrowed at max LTV
    let actualLtv = (loan.principal / loan.collateralValue) * 100;
    let maxLtv = getMaxLtvForScore(user.scoreAtBorrowTime);
    if (actualLtv >= maxLtv * 0.95) { // Within 5% of max
      maxLtvCount++;
    }
  }

  // Base score from collateralization ratio
  let avgRatio = totalCollateralUsd / totalBorrowedUsd;
  let baseScore = 0;

  if (avgRatio >= 2.0) baseScore = 100;       // 200%+ collateral
  else if (avgRatio >= 1.5) baseScore = 75;   // 150-200%
  else if (avgRatio >= 1.2) baseScore = 50;   // 120-150%
  else if (avgRatio >= 1.0) baseScore = 25;   // 100-120%
  else baseScore = 0;                         // Underwater

  // Penalty for max LTV borrowing
  let maxLtvPct = maxLtvCount / user.loans.length;
  let penalty = 0;
  if (maxLtvPct > 0.75) penalty = 40;
  else if (maxLtvPct > 0.50) penalty = 20;

  // Bonus for collateral diversity
  let bonus = 0;
  if (uniqueAssets.size >= 3) bonus = 20;
  else if (uniqueAssets.size >= 2) bonus = 10;

  // Final score (clamped 0-100)
  return clamp(baseScore - penalty + bonus, 0, 100);
}
```

### Data Structures

```solidity
struct CollateralData {
    uint256 collateralValueUsd18;
    uint256 principalUsd18;
    address collateralToken;
    uint16 userScoreAtBorrow;
}

mapping(uint256 => CollateralData) public loanCollateralData;
mapping(address => address[]) public userCollateralAssets;
```

### Registry Updates Required
- Track collateral value at loan creation
- Track user's score at borrow time
- Maintain set of unique collateral assets per user

---

## S3 - Sybil Resistance (20% weight) 🔄 ENHANCE

### Current Status (Phase 3 Incremental)
- ✅ Wallet age tracking
- ✅ Staking bonuses
- ❌ KYC integration (placeholder -150 penalty)

### Phase 3B Enhancements

#### 1. Didit KYC Integration

**Didit Workflow**:
```
1. User completes KYC via Didit SDK (frontend)
2. Didit issues verifiable credential (VC)
3. User submits proof to CreditRegistry
4. Registry verifies signature via ECDSA
5. Registry stores kycVerified = true (hashed proof)
6. Oracle rewards +150 points for verified users
```

**Implementation**:
```solidity
struct KYCProof {
    bytes32 credentialHash;    // Hash of Didit VC
    uint256 verifiedAt;        // Timestamp
    uint256 expiresAt;         // VC expiration
}

mapping(address => KYCProof) public kycProofs;

function submitKYCProof(
    bytes32 credentialHash,
    uint256 expiresAt,
    bytes memory signature
) external {
    // Verify signature from Didit issuer
    require(verifyKYCSignature(msg.sender, credentialHash, expiresAt, signature), "Invalid KYC proof");

    kycProofs[msg.sender] = KYCProof({
        credentialHash: credentialHash,
        verifiedAt: block.timestamp,
        expiresAt: expiresAt
    });

    emit KYCVerified(msg.sender, credentialHash, expiresAt);
}
```

#### 2. Enhanced Sybil Scoring

```typescript
function calculateS3(user: address): int16 {
  let score = 0;

  // KYC Verification (+150 or -150)
  if (user.kycVerified && user.kycExpiry > now) {
    score += 150;
  } else {
    score -= 150;
  }

  // Wallet Age
  let walletAge = now - user.firstSeen;
  if (walletAge < 30 days) score -= 300;
  else if (walletAge < 90 days) score -= 200;
  else if (walletAge < 180 days) score -= 100;
  else if (walletAge < 365 days) score -= 50;
  // else no penalty

  // Staking Bonus
  if (user.stakedAmount >= 1000 ether) score += 75;
  else if (user.stakedAmount >= 500 ether) score += 50;
  else if (user.stakedAmount >= 100 ether) score += 25;

  // On-chain Activity (NEW)
  if (user.txCount >= 100) score += 50;
  else if (user.txCount >= 50) score += 30;
  else if (user.txCount >= 20) score += 15;

  return score; // Can be negative
}
```

---

## S4 - Cross-Chain Reputation (10% weight) 🆕

### Objective
Reward users with good credit history across multiple chains using Chainlink CCIP.

### Architecture

```
┌─────────────┐      CCIP        ┌─────────────┐
│  Arbitrum   │ ←──────────────→ │  Optimism   │
│  Registry   │                  │  Registry   │
└─────────────┘                  └─────────────┘
       ↓                                ↓
       └────────────────┬───────────────┘
                        ↓
              ┌──────────────────┐
              │ Aggregated Score │
              │ (Cross-Chain)    │
              └──────────────────┘
```

### CCIP Integration

**Message Structure**:
```solidity
struct CrossChainReputationMessage {
    address user;
    uint16 overallScore;
    uint256 totalLoans;
    uint256 repaidLoans;
    uint256 liquidatedLoans;
    uint64 sourceChainSelector;
}
```

**Sender (Source Chain)**:
```solidity
function sendReputationUpdate(address user, uint64 destChainSelector) external {
    ScoreBreakdown memory score = oracle.computeScore(user);
    LoanStats memory stats = registry.getUserLoanStats(user);

    Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
        receiver: abi.encode(destRegistryAddress),
        data: abi.encode(CrossChainReputationMessage({
            user: user,
            overallScore: score.overall,
            totalLoans: stats.totalLoans,
            repaidLoans: stats.repaidLoans,
            liquidatedLoans: stats.liquidatedLoans,
            sourceChainSelector: chainSelector
        })),
        tokenAmounts: new Client.EVMTokenAmount[](0),
        feeToken: address(linkToken),
        extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000}))
    });

    IRouterClient(ccipRouter).ccipSend(destChainSelector, message);
}
```

**Receiver (Destination Chain)**:
```solidity
function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
    CrossChainReputationMessage memory rep = abi.decode(message.data, (CrossChainReputationMessage));

    // Store cross-chain reputation
    crossChainScores[rep.user][rep.sourceChainSelector] = CrossChainScore({
        overallScore: rep.overallScore,
        totalLoans: rep.totalLoans,
        repaidLoans: rep.repaidLoans,
        updatedAt: block.timestamp
    });

    emit CrossChainReputationReceived(rep.user, rep.sourceChainSelector, rep.overallScore);
}
```

### Scoring Algorithm

```typescript
function calculateS4(user: address): int16 {
  let score = 0;
  let chainCount = 0;
  let totalCrossChainScore = 0;

  // Aggregate scores from other chains
  for (chainSelector of supportedChains) {
    if (crossChainScores[user][chainSelector].updatedAt > 0) {
      chainCount++;
      totalCrossChainScore += crossChainScores[user][chainSelector].overallScore;
    }
  }

  if (chainCount === 0) {
    return 0; // Neutral if no cross-chain history
  }

  // Average cross-chain score
  let avgCrossChainScore = totalCrossChainScore / chainCount;

  // Base score from cross-chain average
  if (avgCrossChainScore >= 75) score = 100;
  else if (avgCrossChainScore >= 60) score = 75;
  else if (avgCrossChainScore >= 45) score = 50;
  else if (avgCrossChainScore >= 30) score = 25;
  else score = 0;

  // Bonus for multi-chain presence
  if (chainCount >= 3) score += 20;
  else if (chainCount >= 2) score += 10;

  return score; // Range: 0-120 (clamped to 0-100 in final calc)
}
```

### Supported Chains (Initial)
- Arbitrum One
- Optimism
- Base
- Polygon

---

## S5 - Governance Participation (10% weight) 🆕

### Objective
Reward active ecosystem participants who engage in governance and protocol improvement.

### Metrics Tracked
1. **Voting Activity**: Number of governance votes cast
2. **Proposal Creation**: Number of proposals submitted
3. **Delegation Power**: Amount of voting power delegated to user
4. **Vote Diversity**: Voting on different proposal types

### Data Sources

**On-Chain Governance** (Governor Bravo/OZ Governor):
```solidity
interface IGovernance {
    function getVotes(address account, uint256 blockNumber) external view returns (uint256);
    function hasVoted(uint256 proposalId, address account) external view returns (bool);
    function proposalCount() external view returns (uint256);
}
```

**Snapshot (Off-Chain)**:
- Track participation via Snapshot API
- Verify signatures and participation proof

### Scoring Algorithm

```typescript
function calculateS5(user: address): int16 {
  let score = 0;

  // 1. Voting Activity (max 40 points)
  let voteCount = getUserVoteCount(user);
  if (voteCount >= 20) score += 40;
  else if (voteCount >= 10) score += 30;
  else if (voteCount >= 5) score += 20;
  else if (voteCount >= 1) score += 10;

  // 2. Proposal Creation (max 30 points)
  let proposalCount = getUserProposalCount(user);
  if (proposalCount >= 5) score += 30;
  else if (proposalCount >= 3) score += 20;
  else if (proposalCount >= 1) score += 10;

  // 3. Voting Power / Delegation (max 20 points)
  let votingPower = governance.getVotes(user, block.number);
  if (votingPower >= 10000 ether) score += 20;
  else if (votingPower >= 5000 ether) score += 15;
  else if (votingPower >= 1000 ether) score += 10;
  else if (votingPower >= 100 ether) score += 5;

  // 4. Participation Consistency (max 10 points)
  let participationRate = voteCount / totalProposals;
  if (participationRate >= 0.75) score += 10;
  else if (participationRate >= 0.50) score += 7;
  else if (participationRate >= 0.25) score += 5;

  return score; // Range: 0-100
}
```

### Registry Updates

```solidity
struct GovernanceActivity {
    uint256 voteCount;
    uint256 proposalCount;
    uint256 lastVoteTimestamp;
    uint256 lastProposalTimestamp;
}

mapping(address => GovernanceActivity) public governanceActivity;

function recordVote(address voter, uint256 proposalId) external onlyGovernance {
    governanceActivity[voter].voteCount++;
    governanceActivity[voter].lastVoteTimestamp = block.timestamp;
    emit VoteRecorded(voter, proposalId);
}

function recordProposal(address proposer, uint256 proposalId) external onlyGovernance {
    governanceActivity[proposer].proposalCount++;
    governanceActivity[proposer].lastProposalTimestamp = block.timestamp;
    emit ProposalRecorded(proposer, proposalId);
}
```

---

## Updated Score Calculation (Phase 3B)

### Formula
```
Overall Score = (S1 * 0.40) + (S2 * 0.20) + (S3_normalized * 0.20) + (S4 * 0.10) + (S5 * 0.10)

Where:
- S1: Repayment History (0-100)
- S2: Collateral Utilization (0-100)
- S3: Sybil Resistance (-450 to +295, normalized to 0-100)
- S4: Cross-Chain Reputation (0-100)
- S5: Governance Participation (0-100)
```

### S3 Normalization
```typescript
function normalizeS3(s3_raw: int16): uint8 {
  // S3 range: -450 to +295 (745 point range)
  // Normalize to 0-100

  let min = -450;
  let max = 295;
  let range = max - min; // 745

  let normalized = ((s3_raw - min) * 100) / range;
  return clamp(normalized, 0, 100);
}
```

### Example Scores

**Excellent User**:
- S1: 100 (perfect repayment)
- S2: 90 (conservative borrowing, 2+ assets)
- S3: 75 (KYC + aged wallet + staking) → normalized
- S4: 80 (good reputation on 2+ chains)
- S5: 60 (active governance participant)
- **Overall**: (100*0.4) + (90*0.2) + (75*0.2) + (80*0.1) + (60*0.1) = **87**

**Average User**:
- S1: 50 (some repayments)
- S2: 50 (average collateralization)
- S3: 30 (no KYC, some wallet age) → normalized
- S4: 0 (single chain)
- S5: 10 (minimal governance)
- **Overall**: (50*0.4) + (50*0.2) + (30*0.2) + (0*0.1) + (10*0.1) = **37**

---

## Implementation Plan

### Phase 1: Registry Updates (Week 1)
- [ ] Add S2 collateral tracking
- [ ] Add S3 KYC proof storage
- [ ] Add S4 cross-chain score storage
- [ ] Add S5 governance activity tracking

### Phase 2: Oracle Implementation (Week 1-2)
- [ ] Implement S2 scoring logic
- [ ] Enhance S3 with KYC integration
- [ ] Implement S4 scoring logic
- [ ] Implement S5 scoring logic
- [ ] Update weighted average calculation

### Phase 3: CCIP Integration (Week 2)
- [ ] Deploy CrossChainReputationSender
- [ ] Deploy CrossChainReputationReceiver
- [ ] Configure CCIP routers for Arbitrum/Optimism/Base
- [ ] Test cross-chain message flow

### Phase 4: Governance Integration (Week 2)
- [ ] Deploy GovernanceTracker contract
- [ ] Integrate with Governor contract
- [ ] Add vote/proposal recording hooks

### Phase 5: Testing (Week 3)
- [ ] Unit tests for each score component
- [ ] Integration tests for full scoring
- [ ] Cross-chain reputation tests
- [ ] Governance participation tests

### Phase 6: Deployment (Week 3)
- [ ] Deploy to Arbitrum Sepolia
- [ ] Deploy to Optimism Sepolia
- [ ] Deploy to Base Sepolia
- [ ] Configure CCIP connections
- [ ] Verify all contracts

---

## Security Considerations

1. **KYC Privacy**: Only store credential hashes, never PII
2. **CCIP Security**: Whitelist source chains and sender contracts
3. **Governance Manipulation**: Rate-limit vote recording, validate proposal IDs
4. **Score Gaming**: Monitor for suspicious patterns (e.g., wash trading across chains)
5. **Oracle Manipulation**: Use time-weighted averages for volatile metrics

---

## Gas Optimization

1. **Lazy Evaluation**: Only compute scores on-demand, not on every action
2. **Caching**: Cache complex calculations (e.g., unique asset count)
3. **Batch Updates**: Batch cross-chain updates to reduce CCIP costs
4. **View Functions**: All scoring logic in view functions (no state changes)

---

## Dependencies

- **OpenZeppelin**: ECDSA, Ownable, ReentrancyGuard
- **Chainlink CCIP**: Cross-chain messaging
- **Didit SDK**: KYC credential verification
- **Governor Bravo/OZ Governor**: Governance integration

---

**Total Development Time**: ~3 weeks
**Estimated Gas Cost**: +15-20% vs Phase 3 Incremental
**New External Dependencies**: CCIP (LINK tokens), Didit API, Governor contracts
