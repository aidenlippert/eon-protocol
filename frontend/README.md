# Eon Protocol - DeFi Credit Scoring Frontend

**Professional Next.js frontend for Phase 3B complete 5-factor credit scoring system**

## 🚀 Quick Deploy

```bash
vercel --prod
```

Set these environment variables in Vercel:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

See `DEPLOY_NOW.md` for detailed instructions.

---

## 📱 Features

### Dashboard Components

1. **CreditScoreCard** - Real-time 5-factor credit score breakdown
2. **BorrowInterface** - Professional borrowing interface with LTV calculation
3. **LoansList** - Complete loan management dashboard
4. **StakingInterface** - EON token staking for score bonus
5. **KYCVerification** - Didit KYC integration (+150 points)

### UI/UX Highlights

✅ Clean, modern dark theme
✅ Responsive design (mobile-first)
✅ Real-time contract data updates
✅ Transaction confirmation tracking
✅ Loading states and error handling
✅ Accessibility-compliant components
✅ Color-coded tier system
✅ Animated progress bars

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Web3**: Wagmi v2 + Viem
- **Wallet**: RainbowKit
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **Animations**: Framer Motion

---

## 📊 Credit Scoring

### 5-Factor System

- **S1 (40%)**: Repayment History - loan count, on-time payments, defaults
- **S2 (20%)**: Collateral Utilization - over-collateralization, diversification
- **S3 (20%)**: Sybil Resistance - KYC verification ±150, staking bonus, wallet age
- **S4 (10%)**: Cross-Chain Reputation - multi-chain presence (CCIP-ready)
- **S5 (10%)**: Governance Participation - voting, proposals

### Credit Tiers

| Tier | Score | Max LTV | APR |
|------|-------|---------|-----|
| Bronze | 0-59 | 50% | 15% |
| Silver | 60-74 | 70% | 10% |
| Gold | 75-89 | 80% | 7% |
| Platinum | 90-100 | 90% | 4% |

---

## 🔗 Deployed Contracts (Arbitrum Sepolia)

```
CreditRegistryV3:     0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9
ScoreOraclePhase3B:   0x3460891EbdDeA80F44c56Cb97a239031C22B2b7e
CreditVaultV3:        0x52F65D2A3BacE77F7dee738F439f2F106B0c5a4d
```

See `../PHASE3B_DEPLOYED.md` for full contract details.

---

## 🧪 Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

### Requirements

- Node.js 20+
- Arbitrum Sepolia testnet ETH
- MetaMask or compatible wallet

---

## 📖 Documentation

- `DEPLOY_NOW.md` - Quick deployment guide
- `../PHASE3B_FRONTEND_COMPLETE.md` - Complete feature documentation
- `../KYC_INTEGRATION_GUIDE.md` - KYC integration details
- `../PHASE3B_DEPLOYED.md` - Contract deployment info

---

## 🔐 Security

- Privacy-first KYC (only hash stored on-chain)
- Signature verification for KYC proofs
- ERC-20 approval safety checks
- LTV enforcement
- Grace period protection
- Reentrancy protection

---

**Built with Next.js, Wagmi, and RainbowKit**
