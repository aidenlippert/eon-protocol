# Eon Protocol - Frontend Deployment Guide

## Phase 3B Complete 5-Factor Credit Scoring System

### Deployed Contracts (Arbitrum Sepolia)

```
CreditRegistryV3:     0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9
ScoreOraclePhase3B:   0x3460891EbdDeA80F44c56Cb97a239031C22B2b7e
CreditVaultV3:        0x52F65D2A3BacE77F7dee738F439f2F106B0c5a4d
StakingTokenV3:       0xf1221c402FD8d45A94AbCC62b60c58197C79baa1
MockUSDC:             0x39f8679380663f0F5EBE47958D0d183cE7fad268
MockWETH:             0x3e4a0315E5dF68bbf4fee8F0F3AC4A181Cfe67e1
```

---

## 🚀 Quick Deploy to Vercel

### Option 1: Vercel CLI (Recommended)

```bash
cd /tmp/eon-protocol/frontend

# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**Environment Variables (Set in Vercel Dashboard)**:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=946b25b33d5bf1a42b32971e742ce05d
NEXT_PUBLIC_SUPABASE_URL=https://jsjfguvsblwvkpzvytbk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzamZndXZzYmx3dmtwenZ5dGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyODgsImV4cCI6MjA3NDk2MTI4OH0.XcELLwh1s-16yliM7lHD2_Wnl4vN1kzm4DdLQ6_V_fg
```

### Option 2: GitHub + Vercel

1. **Push to GitHub**:
   ```bash
   cd /tmp/eon-protocol
   git add .
   git commit -m "🚀 Phase 3B: Complete 5-factor credit scoring with professional frontend"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Set root directory to `frontend`
   - Add environment variables above
   - Deploy!

---

## 📱 Frontend Features

### Dashboard Components

1. **CreditScoreCard** - Real-time 5-factor score breakdown
2. **BorrowInterface** - Professional borrow interface with LTV calculation
3. **LoansList** - Complete loan management dashboard
4. **StakingInterface** - EON token staking for score bonus
5. **KYCVerification** - Didit KYC integration (+150 points)

### Technology Stack
- Next.js 15, Tailwind CSS v4, Framer Motion
- Wagmi v2 + Viem + RainbowKit
- TypeScript, Radix UI, Lucide React

---

## 🔧 Vercel Deployment

Access the frontend directory:
```bash
cd /tmp/eon-protocol/frontend
```

Deploy:
```bash
vercel --prod
```

The build will run on Vercel's servers (avoiding local memory issues).

---

## 📊 Credit Scoring System

**S1: Repayment History (40%)** - Perfect record = 100 points
**S2: Collateral Utilization (20%)** - Over-collateralization bonus
**S3: Sybil Resistance (20%)** - KYC ±150, Staking +25/+50/+75
**S4: Cross-Chain Reputation (10%)** - CCIP-ready
**S5: Governance Participation (10%)** - Voting & proposals

---

## 🎯 Credit Tiers

| Tier | Score | Max LTV | APR | Grace |
|------|-------|---------|-----|-------|
| Bronze | 0-59 | 50% | 15% | 24h |
| Silver | 60-74 | 70% | 10% | 48h |
| Gold | 75-89 | 80% | 7% | 60h |
| Platinum | 90-100 | 90% | 4% | 72h |

---

**Built with Next.js, Wagmi, and RainbowKit**
