# 🧪 Phase 1 Testnet Testing Plan - Eon Protocol

**Network**: Arbitrum Sepolia
**Objective**: Comprehensive manual testing of all Phase 1 features before mainnet deployment
**Duration**: 3-5 days
**Team**: You + Me

---

## 📋 Pre-Testing Setup

### 1. Contract Deployment
```bash
cd /tmp/eon-protocol
npx hardhat run contracts/deploy-phase1.ts --network arbitrumSepolia
```

**Expected Output**:
- ✅ ReputationScorer deployed at: `0x...`
- ✅ DutchAuctionLiquidator deployed at: `0x...`
- ✅ HealthFactorMonitor deployed at: `0x...`
- ✅ InsuranceFund deployed at: `0x...`
- ✅ All contracts verified on Arbiscan

**Save all addresses** in `.env.testnet`:
```
REPUTATION_SCORER=0x...
LIQUIDATOR=0x...
HEALTH_MONITOR=0x...
INSURANCE_FUND=0x...
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env.testnet
# Update with testnet contract addresses
npm run dev
```

### 3. Database Setup
```bash
# Run schema on Supabase test instance
psql -h your-supabase-url -f database/phase1-schema.sql
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 5. Test Wallets
Create 5 test wallets with Arbitrum Sepolia ETH:
- **Wallet 1 (Owner)**: Contract deployer, admin functions
- **Wallet 2 (Bronze Borrower)**: New user, low credit score
- **Wallet 3 (Gold Borrower)**: Established user, good credit
- **Wallet 4 (Platinum Borrower)**: VIP user, excellent credit
- **Wallet 5 (Liquidator)**: Executes liquidations

Get testnet ETH: https://faucet.quicknode.com/arbitrum/sepolia

---

## 🎯 Test Scenarios

### **Scenario 1: New User Journey (Bronze Tier)**
**Objective**: Verify complete flow for brand new user
**Wallet**: Wallet 2 (Bronze)
**Duration**: 1-2 hours

#### Steps:
1. **Setup Credit Score**
   - Call `ReputationScorer.calculateScore(wallet2, 250)`
   - Expected: Score = 250, Tier = "Bronze", LTV = 50%
   - Verify on frontend: Credit dashboard shows Bronze badge

2. **Create First Loan**
   - Deposit 1 ETH collateral
   - Borrow 0.5 ETH (50% LTV)
   - Expected: Loan created, health factor ≈ 1.0
   - Verify on frontend: Loan appears in "My Loans" section

3. **Monitor Health Factor**
   - Check HealthFactorMonitor every 5 minutes
   - Expected: Backend alerts service running, no alerts (healthy loan)
   - Verify in database: `health_factors` table updated

4. **Make On-Time Payment**
   - Repay 0.1 ETH before due date
   - Call `recordPayment(wallet2, loanId, 0.1 ETH, dueDate, true)`
   - Expected: Payment recorded, score improves slightly
   - Verify in database: `payment_history` table shows on_time = true

5. **Make 11 More On-Time Payments**
   - Repeat payment process 11 times
   - Expected: Score increases after each payment
   - After 12 payments: Tier upgrades to "Silver", LTV = 65%

6. **Verify Tier Upgrade**
   - Check frontend: Badge now shows "Silver"
   - Check contract: `getCreditTier(wallet2)` returns "Silver"
   - Check database: `credit_scores` table shows tier = 'silver', ltv = 65

**Success Criteria**:
- ✅ Bronze user successfully takes first loan
- ✅ On-time payments improve credit score
- ✅ After 12 payments, user upgrades to Silver tier
- ✅ LTV increases from 50% to 65%
- ✅ All events emitted correctly
- ✅ Frontend updates in real-time

---

### **Scenario 2: Health Factor Deterioration & Liquidation (Gold Tier)**
**Objective**: Test liquidation mechanism with grace period
**Wallet**: Wallet 3 (Gold)
**Duration**: 24+ hours (due to grace period)

#### Steps:
1. **Setup Gold Tier Borrower**
   - Call `calculateScore(wallet3, 700)`
   - Expected: Tier = "Gold", LTV = 75%, Grace Period = 24h
   - Record 12 on-time payments in history

2. **Create Healthy Loan**
   - Deposit 1 ETH collateral
   - Borrow 0.75 ETH (75% LTV)
   - Expected: Health Factor ≈ 1.0, Risk Level = "Safe"
   - Verify: No liquidation warnings

3. **Simulate Collateral Drop**
   - Manually increase debt to 0.95 ETH (or update oracle price)
   - Expected: Health Factor drops to ≈ 0.789
   - Backend should trigger **T-24h WARNING** alert

4. **Verify Liquidation Eligibility**
   - Call `isLiquidatable(wallet3, loanId)`
   - Expected: Returns `true` (HF < 0.95)
   - Frontend should show "At Risk" badge

5. **Start Liquidation Auction**
   - As Wallet 5 (Liquidator), call `startLiquidation(loanId)`
   - Expected: Auction created, grace period = 24h
   - Event: `LiquidationStarted(auctionId, loanId, wallet3, timestamp)`

6. **Verify Grace Period Protection**
   - Immediately try `executeLiquidation(auctionId)`
   - Expected: **REVERTS** with "Grace period active"
   - Check `getGracePeriodRemaining(auctionId)` ≈ 86400 seconds

7. **Monitor Discount Calculation**
   - Every 6 hours, call `getCurrentDiscount(auctionId)`
   - Expected:
     - 0h: 0% discount
     - 6h: 0% (still in grace)
     - 12h: 0% (still in grace)
     - 18h: 0% (still in grace)
     - 24h: 0% (grace ends)
     - 25h: ~3.3% discount (1h into auction)
     - 27h: ~10% discount (3h into auction)
     - 30h: ~20% discount (6h into auction, max)

8. **Execute Liquidation After Grace**
   - Wait 24 hours
   - As Wallet 5, call `executeLiquidation(auctionId)`
   - Expected: SUCCESS, collateral transferred to liquidator
   - Verify: Auction marked as executed

9. **Verify Reputation Penalty**
   - Check borrower's score: should decrease by ~10-20%
   - Tier may downgrade from Gold → Silver
   - Verify in database: `credit_scores` updated

**Success Criteria**:
- ✅ Health factor correctly identifies liquidatable position
- ✅ Grace period prevents immediate liquidation
- ✅ Discount calculation works correctly
- ✅ Liquidation executes successfully after grace period
- ✅ Borrower's reputation penalized
- ✅ All alerts sent via backend service

---

### **Scenario 3: Late Payments & Tier Downgrade (Platinum → Gold)**
**Objective**: Test how late payments degrade reputation
**Wallet**: Wallet 4 (Platinum)
**Duration**: 2-3 hours

#### Steps:
1. **Setup Platinum Tier Borrower**
   - Call `calculateScore(wallet4, 850)`
   - Expected: Tier = "Platinum", LTV = 90%
   - Record 12 on-time payments

2. **Create High-LTV Loan**
   - Deposit 1 ETH collateral
   - Borrow 0.9 ETH (90% LTV - max for Platinum)
   - Expected: HF ≈ 1.0, barely safe

3. **Make 8 Late Payments**
   - For each payment, set `onTime = false` and `dueDate` in past
   - Call `recordPayment(wallet4, loanId, amount, pastDueDate, false)`
   - Expected: Score decreases progressively

4. **Verify Score Degradation**
   - After 8 late payments, call `calculateScore(wallet4, 850)`
   - Expected:
     - Payment score drops from ~120 to ~30-40
     - Total score drops from ~850 to ~600-650
     - Tier downgrades to "Gold"
     - LTV reduces from 90% to 75%

5. **Existing Loan Now Unhealthy**
   - Loan was at 90% LTV (safe for Platinum)
   - Now borrower is Gold tier (75% max LTV)
   - Expected: Health factor drops, loan becomes liquidatable
   - Backend triggers alerts

6. **Borrower Options**
   - Add more collateral to bring HF back up
   - OR accept liquidation with shorter grace period (24h vs 72h)

**Success Criteria**:
- ✅ Late payments correctly penalize credit score
- ✅ Tier downgrades when score drops below threshold
- ✅ Existing loans become risky when LTV limits change
- ✅ Payment history accurately tracked in database
- ✅ All score recalculations work correctly

---

### **Scenario 4: Insurance Fund Coverage on Default**
**Objective**: Test insurance fund mechanics
**Wallet**: Owner (Wallet 1)
**Duration**: 1 hour

#### Steps:
1. **Fund Insurance Pool**
   - As Owner, call `insuranceFund.deposit(10,000 USDC)`
   - Expected: Total funds = 10,000 USDC
   - Verify: Event `Deposit(owner, 10000)`

2. **Allocate Protocol Revenue**
   - Simulate 50,000 USDC in protocol revenue
   - Call `allocateRevenue(50,000 USDC)`
   - Expected: 5% allocated = 2,500 USDC
   - Total funds now = 12,500 USDC

3. **Create Defaulted Loan**
   - Bronze borrower takes 100,000 USDC loan
   - Loan defaults with 5,000 USDC loss
   - Maximum coverage = 0.25% of 100,000 = 250 USDC

4. **Cover Loss**
   - Call `coverLoss(lender, loanId, 5000 USDC)`
   - Expected: Lender receives 250 USDC (max coverage)
   - Total funds now = 12,250 USDC
   - Total covered = 250 USDC
   - Total defaults = 1

5. **Create Second Default**
   - Another loan defaults with 3,000 USDC loss
   - Coverage = min(0.25% * principal, available funds)
   - Expected: Additional 250 USDC covered

6. **Check Statistics**
   - Call `getStatistics()`
   - Expected:
     - Total funds ≈ 12,000 USDC
     - Total covered = 500 USDC
     - Total defaults = 2

7. **Test Coverage Limits**
   - Attempt to cover loss larger than fund balance
   - Expected: REVERTS with "Insufficient funds"

**Success Criteria**:
- ✅ Fund deposits work correctly
- ✅ Revenue allocation calculates 5% correctly
- ✅ Coverage capped at 0.25% per loan
- ✅ Multiple defaults handled correctly
- ✅ Statistics accurate
- ✅ Cannot overdraw fund

---

### **Scenario 5: Multiple Concurrent Liquidations (All Tiers)**
**Objective**: Test grace period differentiation across tiers
**Wallets**: Wallet 2 (Bronze), Wallet 3 (Gold), Wallet 4 (Platinum)
**Duration**: 72+ hours (Platinum grace period)

#### Steps:
1. **Setup 3 Borrowers at Different Tiers**
   - Bronze (Wallet 2): Score 300, LTV 50%, Grace 0h
   - Gold (Wallet 3): Score 700, LTV 75%, Grace 24h
   - Platinum (Wallet 4): Score 850, LTV 90%, Grace 72h

2. **Create 3 Unhealthy Loans**
   - All loans have HF < 0.95
   - All become liquidatable simultaneously

3. **Start 3 Liquidation Auctions**
   - Call `startLiquidation()` for all 3 loans
   - Expected: 3 auctions created with different grace periods
   - Verify: `getGracePeriodRemaining()` returns:
     - Auction 1 (Bronze): 0 seconds
     - Auction 2 (Gold): ~86,400 seconds (24h)
     - Auction 3 (Platinum): ~259,200 seconds (72h)

4. **Immediate Liquidation (Bronze)**
   - Try to execute Auction 1 immediately
   - Expected: SUCCESS (no grace period)
   - Borrower loses collateral, reputation drops

5. **Attempt Early Liquidation (Gold & Platinum)**
   - Try to execute Auctions 2 & 3 immediately
   - Expected: REVERTS with "Grace period active"

6. **Wait 24 Hours - Execute Gold Liquidation**
   - After 24h, execute Auction 2
   - Expected: SUCCESS
   - Platinum (Auction 3) still protected

7. **Wait 72 Hours - Execute Platinum Liquidation**
   - After 72h, execute Auction 3
   - Expected: SUCCESS
   - By now, discount should be at max (20%)

8. **Verify Discount Progression**
   - Bronze: Liquidated at 0% discount (immediate)
   - Gold: Liquidated at ~0% discount (right after grace)
   - Platinum: Liquidated at ~20% discount (72h grace + 6h auction)

**Success Criteria**:
- ✅ Different tiers get different grace periods
- ✅ Bronze liquidated immediately
- ✅ Gold protected for 24h
- ✅ Platinum protected for 72h
- ✅ Discounts calculated correctly for each
- ✅ All auctions execute successfully
- ✅ No conflicts between concurrent liquidations

---

### **Scenario 6: Progressive Score Improvement (12 Months)**
**Objective**: Simulate long-term reputation building
**Wallet**: Wallet 2 (starting Bronze)
**Duration**: 3-4 hours (simulated time)

#### Steps:
1. **Month 1: Bronze Tier**
   - Score: 250
   - LTV: 50%
   - Record initial loan + 1 on-time payment

2. **Month 2-4: Build Payment History**
   - Record 11 more on-time payments (total 12)
   - Increment protocol activity count
   - Expected: Score improves, approaching Silver threshold

3. **Month 4: Upgrade to Silver**
   - Call `calculateScore(wallet2, 450)`
   - Expected: Tier = "Silver", LTV = 65%
   - Frontend shows upgrade notification

4. **Month 5-6: Continue Good Behavior**
   - Record 12 more on-time payments (total 24)
   - Increase protocol interactions
   - Expected: Score continues improving

5. **Month 6: Upgrade to Gold**
   - Call `calculateScore(wallet2, 650)`
   - Expected: Tier = "Gold", LTV = 75%
   - Grace period now 24h (vs 0h before)

6. **Month 7-12: Maintain Excellence**
   - Record 24 more on-time payments (total 48)
   - Maximum protocol activity (100 interactions)
   - Wallet age now 12 months

7. **Month 12: Reach Platinum**
   - Call `calculateScore(wallet2, 850)`
   - Expected: Tier = "Platinum", LTV = 90%
   - Grace period now 72h
   - Verify: Leaderboard shows top ranking

8. **Verify Complete Score Breakdown**
   - Temporal: 850 (user input)
   - Payment: ~150 (48/48 on-time)
   - Wallet Age: 73 (12 months)
   - Protocol Activity: 50 (100 interactions)
   - **Total**: ~1123 (but capped at 1000)
   - Final: Tier = "Platinum", LTV = 90%

**Success Criteria**:
- ✅ User progresses from Bronze → Silver → Gold → Platinum
- ✅ LTV increases from 50% → 90% over time
- ✅ Payment history accurately tracked
- ✅ Grace period increases with tier
- ✅ Score breakdown shows all 4 signals
- ✅ Leaderboard updates correctly

---

## 🔍 Edge Case Testing

### **Edge Case 1: Exact Liquidation Threshold**
- Create loan with HF exactly = 0.95
- Verify: Should be liquidatable (threshold is <=, not <)
- Test both sides: 0.9500001 (safe) vs 0.9499999 (liquidatable)

### **Edge Case 2: Zero Debt Loan**
- Create loan with 0 debt (interest paid off)
- Expected: Health Factor = ∞ (MaxUint256)
- Should never be liquidatable

### **Edge Case 3: Zero Collateral Loan**
- Simulate loan with 0 collateral (edge case)
- Expected: Health Factor = 0
- Should be immediately liquidatable

### **Edge Case 4: Very Small Amounts**
- Create loan with 1 wei collateral, 1 wei debt
- Verify: Math works correctly, no overflow/underflow

### **Edge Case 5: Very Large Amounts**
- Create loan with 1,000,000 ETH collateral
- Verify: Gas costs reasonable, calculations accurate

### **Edge Case 6: Insurance Fund Depletion**
- Cover defaults until fund = 0
- Verify: Cannot cover any more losses
- Expected: REVERTS with "Insufficient funds"

### **Edge Case 7: Discount After Auction Ends**
- Check discount 10 hours into 6-hour auction
- Expected: Should cap at 20%, not exceed

### **Edge Case 8: Multiple Loans Same Borrower**
- Create 3 loans for same borrower
- Liquidate 1, keep others healthy
- Verify: Reputation penalty affects all loans

---

## 📊 Performance & Gas Testing

### **Gas Cost Benchmarks**
Run each operation and record gas used:

| Operation | Expected Gas | Actual Gas | Status |
|-----------|--------------|------------|--------|
| calculateScore() | ~100-150K | | |
| recordPayment() | ~80-120K | | |
| startLiquidation() | ~150-200K | | |
| executeLiquidation() | ~200-300K | | |
| calculateHealthFactor() | ~100-150K | | |
| deposit() (Insurance) | ~80-120K | | |
| coverLoss() | ~150-200K | | |

**Success Criteria**: All operations under 500K gas

### **Backend Performance**
- Health monitoring loop: Should complete in <30 seconds for 100 loans
- Credit score calculation: <2 seconds per user
- Alert delivery: <5 seconds from detection to email/push

### **Frontend Performance**
- Page load: <2 seconds
- Credit score update: Real-time (<1 second)
- Health factor display: Updates every 5 minutes automatically

---

## 🐛 Bug Tracking Template

For each bug found:

```markdown
### Bug #X: [Title]
**Severity**: Critical / High / Medium / Low
**Component**: Smart Contract / Backend / Frontend / Database
**Description**: [What went wrong]
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Fix**: [How to fix it]
**Status**: Open / In Progress / Fixed / Won't Fix
```

---

## ✅ Sign-Off Checklist

Before deploying to mainnet, ALL must be ✅:

### Smart Contracts
- [ ] All unit tests pass (150+ tests)
- [ ] All integration tests pass (6 scenarios)
- [ ] All manual testnet tests pass (6+ scenarios)
- [ ] All edge cases handled correctly
- [ ] Gas costs within acceptable range (<500K per operation)
- [ ] Contract verified on Arbiscan
- [ ] Multi-sig setup for owner operations
- [ ] Emergency pause functionality tested

### Backend Services
- [ ] Health monitoring runs continuously without crashes
- [ ] Alert delivery working (email, push, webhook)
- [ ] Credit scoring accurate for all 4 signals
- [ ] Database schema optimized with indexes
- [ ] API rate limiting tested
- [ ] Error handling comprehensive
- [ ] Logging configured for production

### Frontend
- [ ] All pages load correctly
- [ ] Wallet connection working (MetaMask, WalletConnect)
- [ ] Real-time updates functioning
- [ ] Mobile responsive
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Error messages user-friendly
- [ ] Loading states implemented

### Security
- [ ] Access controls tested (onlyOwner, onlyAuthorized)
- [ ] Reentrancy protection verified
- [ ] Integer overflow/underflow impossible (Solidity 0.8.20)
- [ ] No sensitive data in events
- [ ] Rate limiting on backend APIs
- [ ] Input validation on all user inputs

### Documentation
- [ ] README updated with testnet deployment
- [ ] API documentation complete
- [ ] User guide written
- [ ] Developer docs updated
- [ ] Changelog maintained

### Business
- [ ] Economic model validated (5% insurance, 0.25% coverage)
- [ ] Grace periods appropriate (0h/24h/72h)
- [ ] LTV ranges safe (50-90%)
- [ ] Liquidation thresholds reasonable (HF < 0.95)
- [ ] Insurance fund sustainability modeled

---

## 📝 Final Test Report Template

```markdown
# Phase 1 Testnet Test Report

**Date**: [Date Range]
**Network**: Arbitrum Sepolia
**Testers**: [Names]

## Deployment Info
- ReputationScorer: 0x...
- DutchAuctionLiquidator: 0x...
- HealthFactorMonitor: 0x...
- InsuranceFund: 0x...

## Test Results Summary
- Total Tests: X
- Passed: X
- Failed: X
- Pass Rate: XX%

## Scenarios Tested
1. New User Journey (Bronze): ✅ / ❌
2. Liquidation with Grace Period: ✅ / ❌
3. Late Payments & Downgrade: ✅ / ❌
4. Insurance Fund Coverage: ✅ / ❌
5. Concurrent Liquidations: ✅ / ❌
6. Progressive Improvement: ✅ / ❌

## Edge Cases
[List all edge cases tested and results]

## Performance Metrics
[Gas costs, backend response times, frontend load times]

## Bugs Found
[Link to bug tracking]

## Recommendations
[Any improvements before mainnet]

## Sign-Off
- Smart Contracts: ✅ / ❌
- Backend: ✅ / ❌
- Frontend: ✅ / ❌
- Security: ✅ / ❌
- Ready for Mainnet: ✅ / ❌
```

---

## 🚀 Next Steps After Testing

1. **Fix any bugs** found during testing
2. **Re-run failed tests** after fixes
3. **Security audit** (recommended: Trail of Bits, OpenZeppelin, Consensys Diligence)
4. **Economic audit** (verify insurance fund sustainability)
5. **Deploy to mainnet** (Arbitrum One)
6. **Monitor closely** for first 2 weeks
7. **Gradual rollout** (cap total loans initially)

---

**LFG! Let's make sure Eon Protocol is bulletproof before we go live! 🚀**
