# Sybil Resistance System

## The Problem

**You caught the critical flaw**: Without sybil resistance, users could:
- Get a bad credit score
- Create a new wallet
- Start fresh with no history
- Repeat infinitely

This would make credit scoring **USELESS**.

## Our Multi-Layered Solution

### 1. **Massive Wallet Age Penalties** ⏰

New wallets get CRUSHED with penalties:

| Wallet Age | Penalty | Result |
|------------|---------|--------|
| 0-30 days | **-300 points** | Score capped at ~500 MAX |
| 31-90 days | **-200 points** | Still severe penalty |
| 91-180 days | **-100 points** | Moderate penalty |
| 181-365 days | **-50 points** | Small penalty |
| 365+ days | **0 penalty** | No penalty |

**Why it works**: Can't skip time. Must wait 6-12 months to get good score.

### 2. **Proof of Humanity Requirement** 🧑

No verification = **-150 point penalty** + can't get top scores

**Supported Verifications**:
- **Gitcoin Passport** (+100 points, removes penalty)
- **Worldcoin** (+100 points, iris scan)
- **Holonym** (+100 points, ZK proof)

**Result**: One identity per human. Can't create unlimited wallets.

### 3. **Wallet Bundling** 🔗

Link all your wallets together to aggregate reputation:

- 2-3 linked wallets: +25 points
- 4-5 linked wallets: +40 points
- 6+ linked wallets: +50 points

**BUT**: All linked wallets inherit negative history too!

**Why it works**:
- If you liquidate on wallet A, ALL linked wallets get penalized
- Can't escape bad history by switching wallets
- Transparency rewarded, gaming punished

### 4. **Economic Staking** 💰

Stake USDC to show commitment:

| Stake Amount | Bonus |
|--------------|-------|
| 100+ USDC | +25 points |
| 500+ USDC | +50 points |
| 1000+ USDC | +75 points |
| 5000+ USDC | +100 points |

**Why it works**: Adds real cost to sybil attacks. $100-5000 per wallet gets expensive fast.

### 5. **Sybil Detection Algorithm** 🚨

Automatically flags suspicious wallets:

**Red Flags** (cumulative risk score):
- Brand new wallet (<30 days): +40 risk
- No Proof of Humanity: +30 risk
- No staking: +15 risk
- No linked wallets: +10 risk
- Low transaction count: +20 risk

**Risk Score ≥60**: Flagged as suspicious, lending restricted

## Economic Analysis: Cost to Farm

To get a GOOD credit score (670+) by farming:

**PER WALLET**:
- Proof of Humanity verification: **$25-50** (Worldcoin hardware)
- Staking requirement: **$100 minimum**
- Gas for transactions: **$50-100**
- **TIME**: **6+ months** to age wallet

**TOTAL**: **$175-250 AND 6 MONTHS** per wallet

**For 10 wallets**: **$1,750-2,500 AND 6 MONTHS**

**Conclusion**: Not economically viable to farm wallets!

## User Experience

### Good Actor (Legitimate User)
1. Connect wallet
2. Verify with Gitcoin Passport (5 min, free)
3. Stake 100 USDC (get it back when done)
4. Get boosted score immediately
5. Build history over time

### Bad Actor (Trying to Game System)
1. Create new wallet → **-300 penalty** (score capped at ~500)
2. Skip verification → **-150 penalty**
3. No staking → **0 bonus**
4. Flagged as sybil → Lending restricted
5. Must wait 6+ months + spend $175+ to bypass

## Integration with Spectral/Credora Model

Following industry best practices:

- **Spectral**: Wallet bundling with NFCs (Non-Fungible Creditor tokens)
- **Credora**: Cross-chain reputation aggregation
- **RociFi**: NFCS (Non-Fungible Credit Score) 1-10 scale
- **Our approach**: Combines all three + time-locking + staking

## Future Enhancements

1. **Cross-chain bundling**: Aggregate reputation across Ethereum, Arbitrum, Optimism
2. **Social graph analysis**: Friends with other verified humans = bonus
3. **ENS integration**: ENS domain = commitment = bonus
4. **Historical slashing**: Sybil attackers get retroactively penalized
5. **DAO governance**: Community votes on suspicious wallets

## Technical Implementation

```typescript
// Example: New wallet trying to game system
const baseScore = 600; // Good score from fake history
const walletAge = 15; // 15 days old
const poh = { verified: false }; // No verification
const staking = BigInt(0); // No stake
const linkedWallets = []; // No linked wallets

const result = applySybilResistance(baseScore, walletAge, poh, staking, linkedWallets);

// result.finalScore = 300 (minimum)
// Adjustments:
// - Base score: 600
// - Wallet age penalty: -300
// - No verification penalty: -150
// - No staking bonus: 0
// - No bundling bonus: 0
// = 600 - 300 - 150 = 150 → capped at 300 minimum
```

## Why This Works

1. **Time is non-forgeable**: Can't skip 6 months
2. **Identity is scarce**: One human = one Proof of Humanity
3. **Economics punish gaming**: Too expensive to farm
4. **Transparency is rewarded**: Linking wallets gives bonuses
5. **Bad history follows you**: Can't escape via new wallet

**Result**: Legitimate users get rewarded, sybil attackers get crushed.
