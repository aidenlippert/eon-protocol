# EON PROTOCOL - PHASE 1 TECHNICAL ARCHITECTURE

**Timeline**: 6-8 weeks
**Team**: You + Me (AI assistant)
**Goal**: Ship enhanced credit scoring, liquidation, insurance, alerts, and dashboard

---

## SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1 ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Frontend   │◄────►│   Backend    │◄────►│ Blockchain│ │
│  │   (Next.js)  │      │  (Node.js)   │      │  (Arb Sep)│ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                     │       │
│         │                      │                     │       │
│  ┌──────▼──────────────────────▼─────────────────────▼────┐ │
│  │              SUPABASE DATABASE                          │ │
│  │  - Claims                                               │ │
│  │  - Reputation scores                                    │ │
│  │  - Loans                                                │ │
│  │  - Payment history                                      │ │
│  │  - Liquidations                                         │ │
│  │  - Insurance fund                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SMART CONTRACT LAYER

### **Existing Contracts** (Already deployed)
✅ ClaimManager - Temporal ownership claims
✅ ChronosNFT - Soulbound reputation tokens
✅ LendingPool - Basic lending functionality

### **New Contracts to Build** (Phase 1)

#### **1. ReputationScorer.sol** (NEW)
```solidity
// Enhanced multi-signal credit scoring
contract ReputationScorer {
    struct CreditScore {
        uint256 baseScore;          // 0-1000 temporal score
        uint256 paymentScore;       // Payment history (0-200)
        uint256 walletAgeScore;     // Wallet longevity (0-100)
        uint256 protocolScore;      // Cross-protocol activity (0-100)
        uint256 totalScore;         // Combined (0-1400, normalized to 0-1000)
        uint256 lastUpdated;
    }

    mapping(address => CreditScore) public scores;
    mapping(address => uint256[]) public paymentHistory;

    function calculateScore(address user) external returns (uint256);
    function updatePaymentHistory(address user, bool onTime) external;
    function getScoreBreakdown(address user) external view returns (CreditScore memory);
}
```

**Key Functions**:
- `calculateScore()` - Aggregate multi-signal scoring
- `updatePaymentHistory()` - Track repayments
- `getScoreBreakdown()` - Return detailed subscores

---

#### **2. DutchAuctionLiquidator.sol** (NEW)
```solidity
// Dutch auction liquidation with reputation-based grace periods
contract DutchAuctionLiquidator {
    struct LiquidationAuction {
        address borrower;
        uint256 debtAmount;
        uint256 collateralAmount;
        uint256 startTime;
        uint256 startDiscount;      // 0% initially
        uint256 endDiscount;        // 20% after 6 hours
        uint256 gracePeriod;        // 0h, 24h, or 72h based on reputation
        bool executed;
    }

    mapping(uint256 => LiquidationAuction) public auctions;

    function startLiquidation(address borrower, uint256 loanId) external;
    function executeLiquidation(uint256 auctionId) external;
    function getCurrentDiscount(uint256 auctionId) public view returns (uint256);
    function getGracePeriod(address borrower) public view returns (uint256);
}
```

**Liquidation Logic**:
- Reputation 800+: 72-hour grace period
- Reputation 600-799: 24-hour grace period
- Reputation <600: Immediate liquidation
- Discount increases linearly 0% → 20% over 6 hours

---

#### **3. HealthFactorMonitor.sol** (NEW)
```solidity
// Real-time health factor monitoring
contract HealthFactorMonitor {
    // Health Factor = (Collateral Value × LTV) / Debt Value
    // Liquidation when HF < 0.95

    struct HealthStatus {
        uint256 collateralValue;
        uint256 debtValue;
        uint256 dynamicLTV;         // 50-90% based on reputation
        uint256 healthFactor;       // Scaled by 1e18
        bool liquidatable;
    }

    function calculateHealthFactor(address borrower, uint256 loanId) external view returns (uint256);
    function isLiquidatable(address borrower, uint256 loanId) external view returns (bool);
    function updateHealthFactor(address borrower, uint256 loanId) external;
}
```

**Health Factor Formula**:
```
HF = (collateralValue × dynamicLTV) / debtValue
Liquidation threshold: HF < 0.95 (5% safety buffer)
```

---

#### **4. InsuranceFund.sol** (NEW)
```solidity
// Protocol insurance fund for bad debt coverage
contract InsuranceFund {
    uint256 public totalFunds;
    uint256 public constant REVENUE_PERCENTAGE = 5; // 5% of protocol revenue
    uint256 public constant MAX_COVERAGE_PER_LOAN = 25; // 0.25% of principal

    mapping(address => uint256) public lenderContributions;

    function deposit() external payable;
    function allocateRevenue(uint256 protocolRevenue) external;
    function coverLoss(address lender, uint256 loanId, uint256 lossAmount) external returns (uint256);
    function getAvailableCoverage(uint256 principal) public pure returns (uint256);
}
```

**Coverage Logic**:
- 5% of all protocol fees → insurance fund
- Maximum coverage: 0.25% of loan principal
- First-loss protection for lenders

---

#### **5. Updated LendingPool.sol** (ENHANCEMENT)
```solidity
// Enhanced lending pool with dynamic LTV and health monitoring
contract LendingPool {
    // ... existing functions ...

    // NEW: Dynamic LTV based on reputation
    function getDynamicLTV(address borrower) public view returns (uint256) {
        uint256 score = reputationScorer.scores(borrower).totalScore;

        if (score >= 800) return 90;       // Platinum: 90% LTV
        if (score >= 600) return 75;       // Gold: 75% LTV
        if (score >= 400) return 65;       // Silver: 65% LTV
        return 50;                          // Bronze: 50% LTV
    }

    // NEW: Borrow with health factor check
    function borrowWithHealthCheck(
        uint256 collateralAmount,
        uint256 borrowAmount
    ) external {
        require(
            healthMonitor.calculateHealthFactor(msg.sender, loanId) > 0.95e18,
            "Insufficient health factor"
        );
        // ... execute loan ...
    }
}
```

---

## BACKEND LAYER (Node.js + TypeScript)

### **Directory Structure**
```
/backend
  /src
    /indexer          # Blockchain event indexer
    /scoring          # Credit score calculation engine
    /alerts           # Early warning system
    /api              # REST API endpoints
    /jobs             # Cron jobs for monitoring
  /prisma             # Database schema
  /tests
```

### **1. Enhanced Indexer** (`/src/indexer`)

**Files**:
- `blockchain-indexer.ts` - Main event listener
- `claim-processor.ts` - Process temporal claims
- `loan-processor.ts` - Track loans and repayments
- `liquidation-processor.ts` - Monitor liquidation events

**Key Logic**:
```typescript
// blockchain-indexer.ts
class BlockchainIndexer {
  async indexPaymentHistory() {
    // Listen for LoanRepaid events
    lendingPool.on('LoanRepaid', async (borrower, loanId, amount, onTime) => {
      await this.updatePaymentHistory(borrower, onTime);
      await this.recalculateScore(borrower);
    });
  }

  async indexLiquidations() {
    // Track liquidation events for scoring
    liquidator.on('LiquidationExecuted', async (borrower, loanId) => {
      await this.penalizeScore(borrower, -100); // -100 points for liquidation
    });
  }
}
```

---

### **2. Credit Scoring Engine** (`/src/scoring`)

**Files**:
- `multi-signal-scorer.ts` - Aggregate scoring logic
- `temporal-scorer.ts` - Temporal ownership scoring (existing)
- `payment-scorer.ts` - Payment history analysis
- `wallet-age-scorer.ts` - Wallet longevity scoring
- `protocol-activity-scorer.ts` - Cross-protocol behavior

**Example**: `payment-scorer.ts`
```typescript
export class PaymentScorer {
  calculatePaymentScore(paymentHistory: Payment[]): number {
    const recentPayments = paymentHistory.slice(-12); // Last 12 payments
    const onTimeCount = recentPayments.filter(p => p.onTime).length;
    const onTimeRate = onTimeCount / recentPayments.length;

    // Score 0-200 based on on-time payment rate
    const baseScore = onTimeRate * 200;

    // Bonus for perfect record
    const perfectBonus = onTimeRate === 1.0 ? 20 : 0;

    return Math.min(200, baseScore + perfectBonus);
  }
}
```

---

### **3. Early Warning System** (`/src/alerts`)

**Files**:
- `health-monitor.ts` - Real-time position monitoring
- `alert-dispatcher.ts` - Multi-channel alert delivery
- `notification-templates.ts` - Email/SMS templates

**Example**: `health-monitor.ts`
```typescript
export class HealthMonitor {
  async monitorAllPositions() {
    const activeLoans = await db.loan.findMany({ where: { status: 'ACTIVE' } });

    for (const loan of activeLoans) {
      const hf = await this.calculateHealthFactor(loan);

      if (hf < 1.0 && hf >= 0.97) {
        // T-72h warning (3 days from liquidation)
        await this.sendAlert(loan.borrower, 'WARNING_72H', { healthFactor: hf });
      } else if (hf < 0.97 && hf >= 0.95) {
        // T-24h warning (1 day from liquidation)
        await this.sendAlert(loan.borrower, 'WARNING_24H', { healthFactor: hf });
      } else if (hf < 0.95) {
        // T-1h warning (imminent liquidation)
        await this.sendAlert(loan.borrower, 'WARNING_1H', { healthFactor: hf });
        await this.triggerLiquidation(loan);
      }
    }
  }
}
```

---

### **4. REST API** (`/src/api`)

**Endpoints**:
```typescript
// GET /api/credit-score/:address
router.get('/credit-score/:address', async (req, res) => {
  const score = await scoringEngine.getScore(req.params.address);
  res.json(score);
});

// GET /api/health-factor/:address/:loanId
router.get('/health-factor/:address/:loanId', async (req, res) => {
  const hf = await healthMonitor.calculateHealthFactor(
    req.params.address,
    req.params.loanId
  );
  res.json({ healthFactor: hf, liquidatable: hf < 0.95 });
});

// GET /api/payment-history/:address
router.get('/payment-history/:address', async (req, res) => {
  const history = await db.payment.findMany({
    where: { borrower: req.params.address },
    orderBy: { timestamp: 'desc' }
  });
  res.json(history);
});
```

---

## FRONTEND LAYER (Next.js + React)

### **New Pages to Build**

#### **1. Enhanced Profile Page** (`/app/profile/page.tsx`)
```typescript
'use client';

export default function ProfilePage() {
  const { address } = useAccount();
  const { data: creditScore } = useQuery({
    queryKey: ['creditScore', address],
    queryFn: () => fetch(`/api/credit-score/${address}`).then(r => r.json())
  });

  return (
    <div className="space-y-8">
      {/* Credit Score Display */}
      <CreditScoreCard score={creditScore} />

      {/* Score Breakdown */}
      <ScoreBreakdown subscores={creditScore.subscores} />

      {/* Active Loans with Health Factor */}
      <ActiveLoansTable loans={loans} />

      {/* Payment History */}
      <PaymentHistoryChart history={paymentHistory} />

      {/* Score Improvement Tips */}
      <ImprovementTips currentScore={creditScore.totalScore} />
    </div>
  );
}
```

#### **2. Liquidation Dashboard** (`/app/liquidations/page.tsx`)
```typescript
'use client';

export default function LiquidationsPage() {
  const { data: auctions } = useQuery({
    queryKey: ['auctions'],
    queryFn: () => fetch('/api/auctions').then(r => r.json())
  });

  return (
    <div>
      <h1>Active Liquidation Auctions</h1>

      {auctions.map(auction => (
        <AuctionCard
          key={auction.id}
          borrower={auction.borrower}
          debtAmount={auction.debtAmount}
          currentDiscount={auction.currentDiscount}
          gracePeriodEnds={auction.gracePeriodEnds}
          onExecute={() => executeLiquidation(auction.id)}
        />
      ))}
    </div>
  );
}
```

---

## DATABASE SCHEMA (Supabase/PostgreSQL)

### **New Tables**

```sql
-- Payment history tracking
CREATE TABLE payment_history (
    id SERIAL PRIMARY KEY,
    borrower TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    amount TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    paid_date TIMESTAMP,
    on_time BOOLEAN NOT NULL,
    late_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Credit scores with subscores
CREATE TABLE credit_scores (
    borrower TEXT PRIMARY KEY,
    base_score INTEGER NOT NULL,           -- Temporal score
    payment_score INTEGER NOT NULL,        -- Payment history score
    wallet_age_score INTEGER NOT NULL,     -- Longevity score
    protocol_score INTEGER NOT NULL,       -- Cross-protocol activity
    total_score INTEGER NOT NULL,          -- Aggregated score
    ltv_percentage INTEGER NOT NULL,       -- Dynamic LTV (50-90)
    tier TEXT NOT NULL,                    -- Bronze/Silver/Gold/Platinum
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Liquidation auctions
CREATE TABLE liquidation_auctions (
    id SERIAL PRIMARY KEY,
    borrower TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    debt_amount TEXT NOT NULL,
    collateral_amount TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    grace_period_hours INTEGER NOT NULL,  -- 0, 24, or 72
    current_discount INTEGER NOT NULL,     -- 0-20%
    executed BOOLEAN DEFAULT FALSE,
    executor TEXT,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Health factor monitoring
CREATE TABLE health_factors (
    borrower TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    collateral_value TEXT NOT NULL,
    debt_value TEXT NOT NULL,
    health_factor TEXT NOT NULL,         -- Decimal stored as string
    liquidatable BOOLEAN NOT NULL,
    last_checked TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (borrower, loan_id)
);

-- Insurance fund transactions
CREATE TABLE insurance_fund (
    id SERIAL PRIMARY KEY,
    transaction_type TEXT NOT NULL,      -- DEPOSIT, ALLOCATION, PAYOUT
    amount TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    loan_id INTEGER,
    balance_after TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## DEPLOYMENT STRATEGY

### **Infrastructure** (Already set up)
✅ Frontend: Vercel
✅ Database: Supabase
✅ Indexer: Railway
✅ Blockchain: Arbitrum Sepolia testnet

### **New Services to Deploy**

1. **Credit Scoring Service** (Railway)
   - Cron job: Recalculate all scores every 6 hours
   - REST API for score queries

2. **Health Monitor Service** (Railway)
   - Cron job: Check all active loans every 5 minutes
   - Alert dispatcher for liquidation warnings

3. **Liquidation Bot** (Railway)
   - Monitor auctions
   - Auto-execute profitable liquidations

---

## DEVELOPMENT TIMELINE

### **Week 1-2: Smart Contracts + Scoring Engine**
- [ ] Write ReputationScorer.sol
- [ ] Write DutchAuctionLiquidator.sol
- [ ] Write HealthFactorMonitor.sol
- [ ] Write InsuranceFund.sol
- [ ] Update LendingPool.sol
- [ ] Deploy to testnet
- [ ] Build multi-signal scoring engine (backend)

### **Week 2-3: Liquidation + Insurance**
- [ ] Implement Dutch auction logic
- [ ] Build grace period system
- [ ] Create insurance fund mechanism
- [ ] Test liquidation flows

### **Week 3-4: Early Warning System**
- [ ] Build health monitor cron job
- [ ] Implement alert dispatcher (email/SMS/Telegram)
- [ ] Create notification templates
- [ ] Test alert delivery

### **Week 4-5: Frontend Dashboard**
- [ ] Enhanced profile page
- [ ] Credit score breakdown UI
- [ ] Health factor gauges
- [ ] Payment history charts
- [ ] Improvement tips (gamified)

### **Week 5-6: Testing + Launch**
- [ ] End-to-end testing
- [ ] Security audit (self-audit + OpenZeppelin)
- [ ] Deploy to mainnet (Arbitrum)
- [ ] Launch marketing campaign
- [ ] Get first 10 users

---

## SUCCESS METRICS (Phase 1)

**Technical KPIs**:
- [ ] Credit scoring latency < 500ms
- [ ] Health factor updates every 5 minutes
- [ ] Alert delivery < 30 seconds
- [ ] 99.9% uptime for monitoring services

**Business KPIs**:
- [ ] 50+ users with credit scores
- [ ] $1M TVL
- [ ] <2% default rate
- [ ] 10+ active loans

---

## NEXT IMMEDIATE STEPS (RIGHT NOW)

**What do you want to start with?**

1. **Smart Contracts** - Write ReputationScorer.sol first
2. **Backend** - Build credit scoring engine
3. **Frontend** - Enhanced profile dashboard
4. **Full Stack** - I'll build all three in parallel

**Pick a number (1-4) and let's start coding! 🚀**
