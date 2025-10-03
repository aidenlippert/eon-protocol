# Enhanced Credit Scoring System v1.1 - Technical Documentation

## Overview

The Enhanced Credit Scoring System v1.1 is a comprehensive on-chain credit scoring engine that calculates FICO-inspired credit scores (300-850) for DeFi users based on their complete on-chain transaction history.

**Key Improvements over v1.0**:
- ✅ **Liquidation History Tracking**: Monitors past liquidations across Aave V2/V3 and Compound V3
- ✅ **Protocol Quality Scoring**: Rewards interaction with audited, battle-tested protocols
- ✅ **Asset Quality Weighting**: Differentiates between blue-chip assets (ETH, wBTC) and memecoins
- ✅ **DAO Participation**: Tracks governance engagement on Snapshot and Tally
- ✅ **Anti-Sybil Detection**: Prevents gaming through wallet clustering analysis
- ✅ **Enhanced Credit Mix**: Evaluates protocol and asset diversity with quality weighting

## Scoring Model

### Total Points: 125 → Mapped to 300-850 Scale

**Factor Distribution**:
```
1. Payment History (30%)       →  37.5 points max
2. Credit Utilization (25%)    →  31.25 points max
3. Credit History Length (15%) →  18.75 points max
4. Credit Mix (12%)            →  15 points max
5. New Credit (8%)             →  10 points max
6. On-Chain Reputation (10%)   →  12.5 points max
```

---

## 1. Payment History (30% = 37.5 points)

**Components**:
- **On-time Repayments** (15% = 18.75 points)
  - Perfect repayment: 18.75 points
  - Calculated as: (repaidOnTime / totalLoans) × 18.75

- **Liquidation History** (8% = 10 points)
  - 0 liquidations: 10 points
  - 1 old liquidation: 7 points
  - 1 recent liquidation: 5 points
  - 2 liquidations: 2 points
  - 3+ liquidations: -5 points

- **Self-Repayment Ratio** (4% = 5 points)
  - Percentage of loans repaid vs liquidated
  - 100% self-repaid: 5 points
  - Calculated as: (selfRepaid / totalClosed) × 5

- **Health Factor Maintenance** (3% = 3.75 points)
  - Health Factor ≥2.5: 3.75 points
  - Health Factor 2.0-2.5: 3 points
  - Health Factor 1.5-2.0: 2 points
  - Health Factor 1.2-1.5: 1 point
  - Health Factor <1.2: 0 points

**Data Sources**:
- Aave V2/V3: `LiquidationCall` events
- Compound V3: `AbsorbDebt` events
- Chains: Ethereum, Arbitrum, Optimism, Base, Polygon

---

## 2. Credit Utilization (25% = 31.25 points)

**Components**:
- **Current Utilization** (15% = 18.75 points)
  - <20% utilization: 18.75 points
  - 20-30%: 15 points
  - 30-50%: 10 points
  - 50-70%: 5 points
  - >70%: 0 points

- **Collateral Quality** (7% = 8.75 points)
  - Asset Quality Score: 0-100
  - Blue-chip (ETH, wBTC, USDC): 100 → 8.75 points
  - Established (ARB, OP, LINK): 80 → 7 points
  - Mid-cap (CRV, GMX): 60 → 5.25 points
  - Small-cap: 30 → 2.6 points
  - Memecoins: 10 → 0.88 points

- **Position Diversification** (3% = 3.75 points)
  - 4+ different collateral types: 3.75 points
  - 3 types: 2.5 points
  - 2 types: 1.5 points
  - 1 type: 0 points

**Asset Quality Registry**:
```typescript
Tier 1 (Blue Chip): 1.0x weight
├── ETH, WETH, WBTC
├── USDC, USDT, DAI
└── Major stablecoins

Tier 2 (Established): 0.8x weight
├── ARB, OP, MATIC
├── LINK, UNI, AAVE
└── Major L1/L2 tokens

Tier 3 (Mid Cap): 0.6x weight
├── CRV, GMX, RDNT
└── Proven DeFi projects

Tier 4 (Small Cap): 0.3x weight
└── Newer projects, lower liquidity

Tier 5 (High Risk): 0.1x weight
└── Memecoins, highly speculative
```

---

## 3. Credit History Length (15% = 18.75 points)

**Components**:
- **Wallet Age** (8% = 10 points)
  - ≥730 days (2+ years): 10 points
  - 365-730 days: 8 points
  - 180-365 days: 5 points
  - 90-180 days: 2.5 points
  - <90 days: Linear scale (0-2.5 points)

- **DeFi Activity Length** (4% = 5 points)
  - ≥365 days active: 5 points
  - 180-365 days: 4 points
  - 90-180 days: 2.5 points
  - <90 days: Linear scale (0-2.5 points)

- **Transaction Consistency** (3% = 3.75 points)
  - ≥10 tx/month average: 3.75 points
  - 5-10 tx/month: 2.5 points
  - 2-5 tx/month: 1.5 points
  - <2 tx/month: 0 points

---

## 4. Credit Mix (12% = 15 points)

**Components**:
- **Protocol Quality** (6% = 7.5 points)
  - Tier 1 (Blue Chip): +5 points per protocol
    - Aave V2/V3, Compound V3, Uniswap V3
    - Lido, Curve Finance
  - Tier 2 (Established): +3 points per protocol
    - Balancer, GMX, Stargate, Yearn
  - Tier 3 (Emerging): +1 point per protocol
    - Radiant, Synapse
  - Tier 4 (Risky): -2 points per protocol
  - Tier 5 (Blacklist): -5 points per protocol

- **Category Diversity** (2% = 2.5 points)
  - 4+ categories: 2.5 points
  - 3 categories: 1.7 points
  - 2 categories: 1 point
  - 1 category: 0.5 points
  - Categories: lending, dex, staking, yield, derivatives, bridge

- **Asset Diversity** (4% = 5 points)
  - 5+ asset types: 5 points
  - 3-4 assets: 4 points
  - 2 assets: 3 points
  - 1 asset: 1.5 points

---

## 5. New Credit (8% = 10 points)

**Components**:
- **Recent Loan Frequency** (5% = 6.25 points)
  - 0-1 recent loans: 6.25 points
  - 2 loans: 5 points
  - 3 loans: 3 points
  - 4+ loans: 1 point

- **Application Spacing** (3% = 3.75 points)
  - ≥90 days between loans: 3.75 points
  - 30-90 days: 2.5 points
  - 14-30 days: 1.5 points
  - <14 days: 0 points

---

## 6. On-Chain Reputation (10% = 12.5 points)

**Components**:
- **DAO Governance Participation** (4% = 5 points)
  - 20+ votes: 4 points → 5 points (with bonuses)
  - 10-19 votes: 3 points
  - 5-9 votes: 2 points
  - 1-4 votes: 1 point
  - 0 votes: 0 points
  - **Bonus**: +0.5 for recent activity (last 6 months)
  - **Bonus**: +0.5 for multi-DAO participation (3+ DAOs)

- **Protocol Contributions** (3% = 3.75 points)
  - 10+ protocols: 3.75 points
  - 7-9 protocols: 3 points
  - 5-6 protocols: 2 points
  - 3-4 protocols: 1 point
  - <3 protocols: 0 points

- **Anti-Sybil Score** (3% = 3.75 points)
  - Currently: Default 3.75 (assume legitimate)
  - Future (v2.0): Wallet clustering analysis, transaction pattern detection

**Tracked DAOs** (Snapshot):
- Aave, Uniswap, Arbitrum, Optimism, ENS
- Gitcoin, Safe, Balancer, Curve, Compound
- Stargate, Lido

**Tracked Governors** (Tally):
- Arbitrum Governor, Compound Governor Bravo
- Uniswap Governor, Optimism Governor

---

## Score Tiers & Benefits

| Score Range | Tier | LTV | Interest Rate | Risk Premium |
|-------------|------|-----|---------------|--------------|
| 820-850 | Exceptional (Platinum) | 90% | 0.8x base rate | -20% |
| 750-819 | Very Good (Gold) | 75% | 0.9x base rate | -10% |
| 670-749 | Good (Silver) | 65% | 1.0x base rate | 0% |
| 580-669 | Fair (Bronze) | 50% | 1.2x base rate | +20% |
| 300-579 | Subprime | 0% | 1.5x base rate | +50% |

---

## API Usage

### Calculate Enhanced Credit Score

```typescript
import { calculateEnhancedCreditScore } from './enhanced-credit-scorer-v1.1';

const score = await calculateEnhancedCreditScore({
  userAddress: '0x...',

  // Lending positions (from indexer or on-chain query)
  lendingPositions: [
    {
      protocol: 'Aave V3',
      chainId: 42161,
      borrowed: BigInt(50000e6), // 50k USDC
      collateral: BigInt(100000e18), // 100k worth of ETH
      collateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
      healthFactor: 2.5,
      timestamp: Date.now() - 90 * 24 * 60 * 60 * 1000,
      repaid: true,
      liquidated: false,
    },
    // ... more positions
  ],

  // Current position
  currentBorrowed: BigInt(20000e6),
  currentCollateral: BigInt(80000e18),
  currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',

  // Historical utilization
  avgUtilization: 35,
  maxUtilization: 55,

  // Wallet metadata
  walletAgeInDays: 900,
  firstDefiInteraction: new Date('2022-01-01'),
  transactionCount: 1500,

  // Protocol interactions
  protocolInteractions: [
    { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 75 }, // Aave V3
    { address: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', chainId: 42161, count: 50 }, // Compound V3
    // ... more protocols
  ],

  // Asset holdings
  assetHoldings: [
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 150000 }, // WETH
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, valueUSD: 75000 }, // USDC
    // ... more assets
  ],

  // Recent activity
  recentLoans: 2,
  avgTimeBetweenLoans: 60,
});

console.log(score);
```

### Response Format

```typescript
{
  score: 785, // 300-850
  tier: "Very Good",
  recommendedLTV: 75,
  interestRateMultiplier: 0.9,

  breakdown: {
    paymentHistory: {
      score: 35.2,
      weight: 30,
      maxScore: 37.5,
      evidence: {
        totalLoans: 12,
        repaidOnTime: 12,
        liquidations: [],
        avgHealthFactor: 2.65,
        selfRepaymentRatio: 100
      }
    },
    creditUtilization: {
      score: 28.5,
      weight: 25,
      maxScore: 31.25,
      evidence: {
        avgUtilization: 35,
        currentUtilization: 25,
        maxUtilization: 55,
        collateralQuality: 100,
        positionDiversity: 3
      }
    },
    creditHistoryLength: {
      score: 17.8,
      weight: 15,
      maxScore: 18.75,
      evidence: {
        walletAgeInDays: 900,
        firstDefiInteraction: "2022-01-01T00:00:00.000Z",
        defiAgeInDays: 800,
        transactionCount: 1500,
        avgTxPerMonth: 50
      }
    },
    creditMix: {
      score: 13.5,
      weight: 12,
      maxScore: 15,
      evidence: {
        protocolQuality: 18,
        protocolsUsed: ["Aave V3", "Compound V3", "Uniswap V3"],
        assetTypes: ["WETH", "USDC", "WBTC"],
        assetDiversity: 3,
        categoryDiversity: 3
      }
    },
    newCredit: {
      score: 8.5,
      weight: 8,
      maxScore: 10,
      evidence: {
        recentLoans: 2,
        avgTimeBetweenLoans: 60,
        hardInquiries: 0
      }
    },
    onChainReputation: {
      score: 10.2,
      weight: 10,
      maxScore: 12.5,
      evidence: {
        daoVotes: 15,
        protocolContributions: 8,
        sybilScore: 3.75,
        daoParticipation: {
          totalVotes: 15,
          daos: ["Aave", "Arbitrum", "Uniswap"],
          recentVotes: 5,
          votes: [/* ... */]
        }
      }
    }
  },

  metadata: {
    calculatedAt: "2025-01-03T12:00:00.000Z",
    version: "1.1",
    dataQuality: "high" // high | medium | low
  }
}
```

---

## Data Quality Assessment

The system assesses data quality based on:

**High Quality** (≥7 points):
- ≥5 lending positions
- ≥100 transactions
- ≥5 protocol interactions

**Medium Quality** (4-6 points):
- 2-4 lending positions
- 50-99 transactions
- 3-4 protocol interactions

**Low Quality** (<4 points):
- 0-1 lending positions
- <50 transactions
- 0-2 protocol interactions

Scores with low data quality should be treated with caution and may not accurately represent creditworthiness.

---

## Performance Considerations

**Calculation Time**:
- Average: 2-5 seconds
- With liquidation history fetch: 5-10 seconds
- With DAO participation fetch: 8-15 seconds

**Caching Strategy**:
- Cache scores for 24 hours
- Invalidate on new lending activity
- Store in database with timestamp

**Rate Limiting**:
- Snapshot API: 20 requests/minute
- Tally API: 60 requests/minute (with API key)
- On-chain RPC: 100 requests/minute (public endpoints)

---

## Future Enhancements (v2.0)

1. **Machine Learning Calibration**
   - Train model on historical default data
   - Dynamic weight adjustment based on predictive power
   - Anomaly detection for unusual patterns

2. **Cross-Chain Score Aggregation**
   - Unified identity across chains
   - Weighted aggregation by chain activity
   - Cross-chain liquidation tracking

3. **Real-World Asset (RWA) Integration**
   - Off-chain credit bureau data (optional, with user consent)
   - Employment verification via Proof of Work
   - Bank account linking via Plaid (optional)

4. **Advanced Anti-Sybil**
   - Wallet clustering analysis
   - Transaction pattern detection
   - Social graph analysis
   - Humanity proofs (Worldcoin, BrightID)

5. **Predictive Default Model**
   - Probability of default (PD) calculation
   - Loss given default (LGD) estimation
   - Expected loss (EL) forecasting

---

## Migration from v1.0 to v1.1

**Breaking Changes**: None (fully backward compatible)

**New Features**:
- Enhanced scoring factors
- Liquidation history tracking
- DAO participation scoring
- Asset quality weighting

**Recommended Migration**:
1. Deploy v1.1 scoring engine alongside v1.0
2. Run both in parallel for 2 weeks
3. Compare scores for existing users
4. Switch to v1.1 as primary scorer
5. Deprecate v1.0 after 1 month

---

## Support & Feedback

For issues, questions, or suggestions:
- GitHub: [github.com/eon-protocol/backend](https://github.com/eon-protocol/backend)
- Discord: [discord.gg/eonprotocol](https://discord.gg/eonprotocol)
- Email: dev@eonprotocol.xyz

---

*Last Updated: January 3, 2025*
*Version: 1.1.0*
