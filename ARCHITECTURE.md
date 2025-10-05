# 🏗️ EON PROTOCOL - SYSTEM ARCHITECTURE

**The World's First Decentralized Credit Bureau for Web3**

Version: Phase 3+ (Real On-Chain Scoring)  
Last Updated: October 2025  
Status: ✅ Production (Arbitrum Sepolia)

---

## 📐 ARCHITECTURAL VISION

EON Protocol is designed as a **multi-layer, verifiable credit intelligence network** that transforms on-chain behavior into trustworthy, portable credit scores.

**Core Philosophy:**
- **Verifiable by Default** - All scores cryptographically provable
- **Privacy-Preserving** - Zero-knowledge proofs for selective disclosure  
- **Economically Aligned** - Credit data creates real value for all participants
- **Decentrally Governed** - Community-controlled scoring parameters

---

## 🎯 CURRENT SYSTEM (PHASE 3 - LIVE)

### **System Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  Next.js 15 + TypeScript + Wagmi + RainbowKit + Tailwind       │
│  /dashboard | /borrow | /profile | /analytics                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API MIDDLEWARE LAYER                        │
│  /api/score/[address] - Server-side scoring + caching           │
│  • Rate limiting (10 req/min)                                   │
│  • Redis/Memory cache (5min TTL)                                │
│  • Error handling & validation                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPUTATION LAYER (S1-S5)                     │
│  lib/real-credit-score.ts - Modular Scoring Engine              │
│                                                                  │
│  📊 S1: Payment History (35%)                                   │
│     → Repayment ratio - liquidation penalties                   │
│                                                                  │
│  💳 S2: Credit Utilization (30%)                                │
│     → Inverse debt/collateral scoring                           │
│                                                                  │
│  📅 S3: Account Maturity (15%)                                  │
│     → Logarithmic wallet age (max 3 years)                      │
│                                                                  │
│  🌐 S4: DeFi Mix (10%)                                          │
│     → Protocol diversity metrics                                │
│                                                                  │
│  🆕 S5: New Credit (10%)                                        │
│     → Recent loan activity analysis                             │
│                                                                  │
│  Weighted Aggregation: Σ(weight_i × normalize(metric_i))       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA ACQUISITION LAYER                      │
│  lib/blockchain.ts + lib/contract-data.ts                       │
│                                                                  │
│  🔗 Arbitrum Sepolia RPC                                        │
│     → getWalletBalance()                                        │
│     → getAccountAgeDays()                                       │
│     → getFirstTransactionDate()                                 │
│                                                                  │
│  📜 Smart Contracts (ethers.js v6)                              │
│     → CreditRegistry (0xad1e...D7)                              │
│       • User loan history                                       │
│       • Repayment records                                       │
│     → ScoreOracle (0x4E5D...62)                                 │
│       • On-chain stored scores                                  │
│       • Score breakdown data                                    │
│     → CreditVault (0xB1E5...61)                                 │
│       • Active loans                                            │
│       • Collateral deposits                                     │
│       • Utilization ratios                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Full documentation continues...**
See /docs/architecture/ for detailed phase-by-phase breakdown.
