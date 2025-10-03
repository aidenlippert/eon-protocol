# Deploy Eon Protocol Frontend to Vercel 🚀

Complete guide to deploy your Next.js frontend with smart contract integration to Vercel.

## Prerequisites

- ✅ GitHub repository pushed (https://github.com/aidenlippert/eon-protocol)
- ✅ Smart contracts deployed to Arbitrum Sepolia
- ✅ Contract ABIs and addresses configured
- ✅ Frontend integration complete

## Step 1: Get WalletConnect Project ID

1. Visit https://cloud.walletconnect.com/
2. Sign up or log in
3. Create a new project
4. Copy your **Project ID** (you'll need this for Vercel)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel**
   - Visit https://vercel.com/
   - Sign up or log in with your GitHub account

2. **Import Repository**
   - Click "Add New..." → "Project"
   - Select `eon-protocol` from your GitHub repositories
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Your site will be live at: `https://eon-protocol-<random>.vercel.app`

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend directory
cd /tmp/eon-protocol/frontend

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? [Y]
# - Which scope? [Select your account]
# - Link to existing project? [N]
# - What's your project's name? [eon-protocol-frontend]
# - In which directory is your code located? [./]

# Add environment variable
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Deploy to production
vercel --prod
```

## Step 3: Configure Custom Domain (Optional)

1. In Vercel Dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `eon-protocol.xyz`)
4. Update DNS records as instructed by Vercel

## Step 4: Test Deployment

### Verify Contract Integration

Visit your deployed site and test:

1. **Connect Wallet**
   - Click "Connect Wallet" button
   - Select MetaMask or WalletConnect
   - Switch to Arbitrum Sepolia network

2. **Check Dashboard**
   - Navigate to `/dashboard`
   - Verify credit score loads (or shows "No Credit Score")
   - Check health factor displays correctly

3. **Test Borrow Page**
   - Navigate to `/borrow`
   - Verify MockUSDC address is correct
   - Test deposit/borrow/repay forms (if you have testnet USDC)

4. **Verify Profile Page**
   - Navigate to `/profile`
   - Click "Calculate My Score"
   - Verify on-chain data fetching works

### Deployed Contract Addresses (Arbitrum Sepolia)

Your frontend is connected to:
```
CreditRegistryV1_1:   0xBF69B777Af1ADCcF2814344b06AF028d32c4b1FE
LendingPoolV1:        0x19965cACd1893ED591fd20854d95a3Ad923E2712
HealthFactorMonitor:  0x47f57c69339d5e0646Ef925FF1A779e968F20E7e
InsuranceFund:        0x5dC974Ac454534F28C31BCFe07af7272F326B888
MockUSDC:             0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f
```

## Step 5: Configure Production Settings

### Build Performance

Vercel automatically optimizes:
- ✅ Edge caching for static assets
- ✅ Image optimization
- ✅ Automatic HTTPS
- ✅ Global CDN distribution

### Environment Variables

For production deployment, you may want to add:
```
# Vercel Dashboard → Settings → Environment Variables

# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Optional (if you add analytics)
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Build Settings

If build fails, check:
- `vercel.json` is properly configured
- All dependencies are in `package.json`
- TypeScript errors are resolved
- No hardcoded localhost URLs

## Troubleshooting

### Build Fails with "Bus error"

This is a known issue with Turbopack on some systems. Already fixed in `package.json`:
```json
{
  "scripts": {
    "build": "next build",  // ✅ Without --turbopack flag
    "dev": "next dev"
  }
}
```

### "Module not found" Errors

Ensure all imports use correct paths:
```typescript
// ✅ Correct
import { useCreditScore } from '@/lib/hooks/useCreditScore';

// ❌ Wrong
import { useCreditScore } from '../../../lib/hooks/useCreditScore';
```

### TypeScript Errors During Build

Vercel runs type checking during build. If needed, you can disable strict mode temporarily:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": false  // Only for initial deployment, fix types later
  }
}
```

### Contract Calls Fail on Production

1. Verify network is Arbitrum Sepolia (ChainID: 421614)
2. Check contract addresses in `lib/contracts/addresses.ts`
3. Ensure wallet has testnet ETH
4. Check browser console for Web3 errors

## Next Steps After Deployment

1. **Get Testnet Tokens**
   - Get Arbitrum Sepolia ETH from faucet
   - Mint MockUSDC from contract: `0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f`

2. **Share with Community**
   - Tweet your deployment URL
   - Share on crypto Discord servers
   - Get feedback from early users

3. **Monitor Analytics** (Optional)
   - Add Vercel Analytics
   - Track wallet connections
   - Monitor contract interactions

4. **Iterate Based on Feedback**
   - Fix UI bugs
   - Improve UX
   - Add requested features

## Deployment Checklist

- [x] GitHub repository pushed
- [x] Smart contracts deployed
- [x] Contract addresses configured
- [x] Frontend integration tested locally
- [ ] WalletConnect Project ID obtained
- [ ] Vercel account created
- [ ] Environment variables added
- [ ] Project deployed to Vercel
- [ ] Production site tested
- [ ] Custom domain configured (optional)

## Support

**Deployed Contracts**: See addresses above
**Block Explorer**: https://sepolia.arbiscan.io/
**Test Network**: Arbitrum Sepolia
**Documentation**: See INTEGRATION_COMPLETE.md

---

**Ready to deploy?** Follow Step 2 above! 🚀

Your deployment URL will be: `https://eon-protocol-<random>.vercel.app`

After deployment, test at: `https://your-url.vercel.app/dashboard`
