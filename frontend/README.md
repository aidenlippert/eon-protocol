# Eon Protocol Frontend

**Barebones 3-page dApp for temporal reputation claims**

## Quick Start

```bash
# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
# Add your WalletConnect Project ID

# Run development server
npm run dev
```

Open http://localhost:3000

## Pages

### 1. Home (`/`)
- Hero + how it works
- Connect wallet
- Navigate to claim or profile

### 2. Claim (`/claim`)
- Submit temporal ownership claim
- Input: ETH amount + duration
- Output: Estimated reputation score + LTV
- Submits to ClaimManager contract

### 3. Profile (`/profile`)
- View credit score (0-1000)
- See LTV, available credit, risk tier
- List active claims
- Borrow ETH button

## Setup After Contract Deployment

1. Deploy contracts to Arbitrum Sepolia
2. Copy addresses from `deployments-arbitrumSepolia.json`
3. Update `app/contracts.ts`:
   ```typescript
   export const CONTRACTS = {
     arbitrumSepolia: {
       claimManager: '0xYOUR_ADDRESS_HERE',
       chronosNFT: '0xYOUR_ADDRESS_HERE',
       lendingPool: '0xYOUR_ADDRESS_HERE',
     }
   };
   ```

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Get WalletConnect ID:**
1. Go to https://cloud.walletconnect.com
2. Create new project
3. Copy Project ID

## Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add environment variables in Vercel dashboard.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Web3:** wagmi v2 + viem v2
- **Wallet:** RainbowKit
- **Chain:** Arbitrum Sepolia (testnet)

## Features

✅ Wallet connection (RainbowKit)
✅ Chain validation (Arbitrum Sepolia only)
✅ Real-time reputation scoring
✅ Contract interaction (submitClaim)
✅ Responsive design (mobile-friendly)

## Missing (Add Later)

❌ Supabase integration (fetch real credit profiles)
❌ Borrow page (lending pool interaction)
❌ Claim finalization
❌ Loan repayment
❌ Analytics dashboard
❌ Dark/light mode toggle

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Troubleshooting

**Error: "Chain mismatch"**
→ Switch to Arbitrum Sepolia in wallet

**Error: "Contract not deployed"**
→ Update contract addresses in `app/contracts.ts`

**Error: "Insufficient funds"**
→ Get testnet ETH from https://faucet.quicknode.com/arbitrum/sepolia

## Next Steps

1. Deploy contracts
2. Update contract addresses
3. Connect Supabase for real data
4. Test with real claims
5. Deploy to Vercel
6. Share with testers
