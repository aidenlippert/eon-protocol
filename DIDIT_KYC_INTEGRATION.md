# Didit KYC Integration Guide

## Overview

Eon Protocol uses **Didit** for FREE, real KYC verification to prevent sybil attacks and score gaming. This is a MASSIVE improvement over theoretical "Proof of Humanity" solutions because:

1. **FREE** - No cost to users (vs $25-50 for Gitcoin Passport)
2. **REAL** - Actual government ID verification + optional liveness check
3. **FAST** - Takes ~5 minutes to complete
4. **WORKING** - Live integration, not theoretical

## Didit Credentials

```
App ID: ad40f592-f0c7-4ee9-829d-4c0882a8640b
API Key: qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A
API Base: https://api.didit.me/v1
```

## How It Works

### User Flow

1. **Unverified State**
   - User connects wallet
   - Calculates score → Gets -150 penalty for no KYC
   - Sees big green button: "Verify Identity with Didit (FREE)"

2. **Verification Process**
   - User clicks button
   - Didit KYC popup opens (500x700px window)
   - User uploads government ID (passport, driver's license, etc.)
   - Optional: Liveness check (selfie video)
   - Takes ~5 minutes

3. **Verified State**
   - System polls Didit API every 5 seconds
   - When verified, auto-refreshes score
   - User gets:
     - **Basic KYC**: +100 points + removes -150 penalty = **+250 total!**
     - **Full KYC**: +150 points + removes -150 penalty = **+300 total!**

### Technical Flow

```typescript
// 1. Check current KYC status
const status = await checkKYCStatus(walletAddress);
// Returns: { verified, verificationLevel, verificationDate, userData }

// 2. If not verified, initiate KYC
const { verificationUrl, sessionId } = await initiateKYCVerification(walletAddress);
// Opens popup: window.open(verificationUrl, '_blank', 'width=500,height=700')

// 3. Poll for completion
setInterval(async () => {
  const updated = await checkKYCStatus(walletAddress);
  if (updated.verified) {
    // KYC complete! Recalculate score
  }
}, 5000); // Check every 5 seconds

// 4. Calculate bonus/penalty
const kycResult = calculateKYCBonus(verification);
// Returns: { bonus: 100-150, penalty: 0 or -150, total }
```

## Didit API Integration

### POST /verification/create

**Request:**
```json
{
  "walletAddress": "0x1234...",
  "verificationLevel": "basic",  // or "full"
  "redirectUrl": "https://app.eon.com/profile?verification=complete"
}
```

**Response:**
```json
{
  "verificationUrl": "https://verify.didit.me/session/abc123",
  "sessionId": "abc123"
}
```

### GET /verification/status?walletAddress=0x1234...

**Response (Not Verified):**
```json
{
  "status": "pending",  // or "rejected", "expired"
  "verifiedAt": null,
  "expiresAt": null,
  "verificationLevel": null,
  "userData": null
}
```

**Response (Verified):**
```json
{
  "status": "verified",
  "verifiedAt": "2025-10-03T12:34:56Z",
  "expiresAt": "2026-10-03T12:34:56Z",  // 1 year validity
  "verificationLevel": "basic",  // or "full"
  "userData": {
    "firstName": "John",
    "lastName": "Doe",
    "country": "US",
    "documentType": "passport"
  }
}
```

## Score Impact

### Before KYC

```
Base Score: 584 (Silver)
Wallet Age Penalty: -200 (90 days old)
No KYC Penalty: -150
Staking Bonus: 0
Bundling Bonus: 0

Final Score: 234 (Bronze) ❌
```

### After Basic KYC

```
Base Score: 584 (Silver)
Wallet Age Penalty: -200 (90 days old)
KYC Bonus: +100 ✅
No KYC Penalty: 0 ✅
Staking Bonus: 0
Bundling Bonus: 0

Final Score: 484 (Fair) ✅
Improvement: +250 points!
```

### After Full KYC (ID + Liveness)

```
Base Score: 584 (Silver)
Wallet Age Penalty: -200 (90 days old)
KYC Bonus: +150 ✅✅
No KYC Penalty: 0 ✅
Staking Bonus: 0
Bundling Bonus: 0

Final Score: 534 (Fair) ✅✅
Improvement: +300 points!
```

## Sybil Attack Prevention

### Why Didit Stops Sybil Attacks

1. **Real Identity Required**
   - Government ID verification
   - Can't create fake IDs at scale
   - Liveness check prevents photo spoofing

2. **One Identity Per Human**
   - Didit tracks verified identities
   - Can't verify same person multiple times with different wallets
   - Cross-references with global ID databases

3. **Economic Deterrent**
   - FREE for users, but Didit has fraud detection
   - Fake IDs get flagged → verification rejected
   - Cost to create convincing fake ID: $1000s
   - vs. Reward from better score: Not worth it

4. **Combined with Other Factors**
   - Even with KYC, new wallets still get -300 penalty
   - Still need to wait 6+ months for wallet age penalty to go away
   - Staking still required for maximum score
   - Total cost per wallet: Time (can't skip) + Capital (if want max score)

### Attack Cost Analysis

**Without Didit (Before):**
- Create new wallet: $0
- Wait 6 months: Time
- Total: Just time → EASY to farm

**With Didit (Now):**
- Create new wallet: $0
- Get fake ID: $1000+ (or use real ID once → can't reuse)
- Wait 6 months: Time
- Stake capital: $100-10,000
- Total: $1100+ + time + one real identity → UNECONOMICAL

## UI Components

### Verify Button (Only shows if not verified)

```tsx
{scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 && (
  <Button
    onClick={handleVerifyIdentity}
    disabled={kycLoading}
    className="w-full bg-green-600 hover:bg-green-700"
  >
    {kycLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Verifying Identity...
      </>
    ) : (
      <>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Verify Identity with Didit (FREE)
      </>
    )}
  </Button>
)}
```

### Verification Status Display

```tsx
<div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
  <div className="text-xs text-neutral-400 mb-1">Identity Verification</div>
  <div className={`text-xl font-bold ${
    scoreData.sybilResistance.adjustments.humanityBonus > 0 ? 'text-green-400' :
    scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 ? 'text-red-400' :
    'text-neutral-400'
  }`}>
    {scoreData.sybilResistance.adjustments.humanityBonus > 0
      ? `+${scoreData.sybilResistance.adjustments.humanityBonus}`
      : scoreData.sybilResistance.adjustments.noVerificationPenalty}
  </div>
  {scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 && (
    <div className="text-xs text-red-400/80 mt-1">
      Not verified
    </div>
  )}
  {scoreData.sybilResistance.adjustments.humanityBonus > 0 && (
    <div className="text-xs text-green-400/80 mt-1">
      Verified with Didit ✓
    </div>
  )}
</div>
```

## Recommendations System

The system provides smart recommendations based on verification status:

```tsx
// Not verified
'🔴 CRITICAL: Complete FREE KYC with Didit (+100-150 points, removes -150 penalty)'
'   Click "Verify Identity" button above to start'

// Basic KYC complete
'🟢 UPGRADE: Complete Full KYC with liveness check for +50 more points (Basic: +100 → Full: +150)'

// Full KYC complete
'✅ You have optimal verification! No improvements needed.'
```

## Testing

### Test Flow

1. Connect wallet on Arbitrum Sepolia testnet
2. Click "Calculate My Score"
3. Should see -150 penalty for no KYC
4. Click "Verify Identity with Didit (FREE)" button
5. Didit popup opens
6. Complete KYC process (use real ID on testnet!)
7. Wait for polling to detect completion
8. Score auto-refreshes with +100-150 bonus

### Expected Results

- **Before KYC**: Score with -150 penalty
- **After KYC**: +250-300 point improvement
- **UI Updates**: Green checkmark, bonus shown, penalty removed
- **Recommendations**: Changes from "CRITICAL: Verify" to "✅ Optimal"

## Production Deployment

### Environment Variables

```env
NEXT_PUBLIC_DIDIT_APP_ID=ad40f592-f0c7-4ee9-829d-4c0882a8640b
DIDIT_API_KEY=qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A
```

### Security Notes

1. **API Key Protection**
   - API key should be in server-side environment variables
   - Client-side only needs App ID (public)
   - Use Next.js API routes for sensitive operations

2. **Verification Data Storage**
   - DO NOT store user's personal data (name, country, etc.)
   - Only store: verified status, verification level, verification date
   - Didit handles all PII, we just check verification status

3. **Rate Limiting**
   - Implement rate limiting on KYC initiation endpoint
   - Prevent spam verification attempts
   - Max 3 attempts per wallet per day

## Future Improvements

1. **Smart Contract Integration**
   - Store KYC status on-chain (verified/not verified only, no PII)
   - Allow other protocols to check verification status
   - Create "verified wallet" NFT badge

2. **Multi-Chain Support**
   - Link verification across all chains
   - One KYC for all user's wallets
   - Cross-chain reputation aggregation

3. **Verification Expiry**
   - KYC expires after 1 year
   - Require re-verification annually
   - Prevents long-term fake identity use

4. **Verification Levels**
   - Basic: ID only (+100)
   - Full: ID + Liveness (+150)
   - Enhanced: ID + Liveness + Address proof (+200)
   - Premium: All of above + credit check (+250)

## Support

- **Didit Docs**: https://docs.didit.me
- **API Reference**: https://docs.didit.me/api
- **Support**: support@didit.me
- **Dashboard**: https://dashboard.didit.me

## Conclusion

Didit KYC transforms our sybil resistance from theoretical to REAL:

- ✅ FREE for users
- ✅ Takes 5 minutes
- ✅ Working API integration
- ✅ +250-300 point score boost
- ✅ Makes wallet farming uneconomical
- ✅ Real government ID verification
- ✅ Professional, trusted provider

This is a **game changer** for preventing score gaming while keeping the system accessible to legitimate users.
