# 🚀 Eon Protocol - Backend Setup Guide

This guide will walk you through setting up the Supabase database and backend infrastructure for Eon Protocol.

## 📋 **Prerequisites**

Before you begin, make sure you have:

- [x] Node.js 18+ installed
- [x] npm or yarn package manager
- [x] A Supabase account (free tier works!)
- [x] An Alchemy API key
- [x] A WalletConnect Project ID
- [x] (Optional) Didit KYC API key

---

## 🗄️ **Step 1: Create Supabase Project**

### 1.1 Sign Up for Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email

### 1.2 Create a New Project

1. Click "New Project"
2. Fill in the details:
   - **Name:** `eon-protocol`
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users (US East, EU West, etc.)
   - **Pricing Plan:** Free tier is perfect for development

3. Click "Create new project"
4. Wait 2-3 minutes for project to initialize

### 1.3 Get Your API Keys

1. Navigate to **Project Settings** (gear icon in sidebar)
2. Go to **API** section
3. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **`anon` public key** (safe to expose to frontend)
   - **`service_role` secret key** (KEEP SECRET! Server-side only)

---

## 🔧 **Step 2: Configure Environment Variables**

### 2.1 Create .env.local File

```bash
cd /tmp/eon-frontend
cp .env.example .env.local
```

### 2.2 Fill in the Values

Open `.env.local` and add your keys:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here  # SECRET!

# Alchemy (get from dashboard.alchemy.com)
NEXT_PUBLIC_ALCHEMY_API_KEY=your-alchemy-key-here

# WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-id-here

# Didit KYC (optional for now)
DIDIT_API_KEY=your-didit-key-here

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

⚠️ **SECURITY WARNING:**
- NEVER commit `.env.local` to git
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Use different keys for development/production

---

## 🗃️ **Step 3: Initialize Database Schema**

### 3.1 Open Supabase SQL Editor

1. In your Supabase dashboard, click **SQL Editor** in the sidebar
2. Click "New query"

### 3.2 Run the Schema

1. Open the file `supabase/schema.sql` in this repository
2. Copy ALL the contents (including comments)
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

This will create:
- ✅ 12 tables (credit_scores, eon_points, lending_positions, etc.)
- ✅ Indexes for performance
- ✅ Triggers for auto-updates
- ✅ Views for analytics
- ✅ Row Level Security policies
- ✅ Seed data for testing

### 3.3 Verify the Schema

Run this query to check all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- `credit_scores`
- `eon_points`
- `kyc_verifications`
- `lending_positions`
- `linked_wallets`
- `liquidation_events`
- `points_transactions`
- `protocol_metrics`
- `referrals`
- `score_challenges`
- `score_history`

---

## 📦 **Step 4: Install Dependencies**

### 4.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 4.2 Install Signature Verification

```bash
npm install viem
```

### 4.3 Verify Installation

```bash
npm run build
```

If the build succeeds, you're good to go! ✅

---

## 🧪 **Step 5: Test the Backend**

### 5.1 Start Development Server

```bash
npm run dev
```

Server should start at [http://localhost:3000](http://localhost:3000)

### 5.2 Test Database Connection

Open [http://localhost:3000/api/health](http://localhost:3000/api/health)

You should see:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

(If this endpoint doesn't exist yet, we'll create it!)

### 5.3 Test Score Calculation API

Let's test the score calculation endpoint:

#### Option A: Using curl

```bash
curl -X POST http://localhost:3000/api/scores/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3",
    "signature": "0x...",
    "message": "Calculate my Eon credit score"
  }'
```

#### Option B: Using the Frontend

1. Go to [http://localhost:3000/profile](http://localhost:3000/profile)
2. Connect your wallet (MetaMask, Coinbase Wallet, etc.)
3. Click "Calculate My Score"
4. Sign the message
5. Wait for the score to be calculated (~10-30 seconds)

### 5.4 Verify Data in Supabase

1. Go to Supabase Dashboard → **Table Editor**
2. Open the `credit_scores` table
3. You should see your wallet address with the calculated score!

---

## 🔍 **Step 6: Understanding the Data Flow**

Here's how the system works:

```
User Clicks "Calculate Score"
    ↓
Frontend generates signature request
    ↓
User signs with wallet
    ↓
POST /api/scores/calculate
    ↓
Backend verifies signature ✅
    ↓
Fetch on-chain data (Alchemy API)
    ↓
Run credit scoring algorithm
    ↓
Store result in Supabase
    ↓
Return score to frontend
    ↓
User sees their credit score! 🎉
```

---

## 📊 **Step 7: Explore the Data**

### View All Tables

In Supabase Dashboard → **Table Editor**, you can:
- Browse all credit scores
- See points balances
- View score history
- Check KYC status
- Monitor lending positions

### Use SQL Editor for Analytics

Try these queries:

#### Top 10 Credit Scores
```sql
SELECT wallet_address, score, tier, updated_at
FROM credit_scores
ORDER BY score DESC
LIMIT 10;
```

#### Points Leaderboard
```sql
SELECT * FROM leaderboard
LIMIT 20;
```

#### Protocol Health Stats
```sql
SELECT * FROM protocol_health;
```

#### Recent Score Changes
```sql
SELECT
  sh.wallet_address,
  sh.score as new_score,
  sh.previous_score,
  sh.change_reason,
  sh.recorded_at
FROM score_history sh
ORDER BY sh.recorded_at DESC
LIMIT 20;
```

---

## 🔧 **Troubleshooting**

### Problem: "Missing Supabase environment variables"

**Solution:**
- Make sure you created `.env.local` (NOT `.env`)
- Verify the variable names match exactly (with `NEXT_PUBLIC_` prefix for public vars)
- Restart the dev server after changing `.env.local`

### Problem: "Database error" when calling API

**Solution:**
- Check your `SUPABASE_SERVICE_ROLE_KEY` is correct (not the anon key!)
- Verify the schema was created successfully
- Check Supabase logs: Dashboard → **Logs** → **Postgres Logs**

### Problem: "Signature verification failed"

**Solution:**
- Make sure the wallet address matches the signature
- The message must match exactly what was signed
- Try disconnecting and reconnecting your wallet

### Problem: "Rate limit exceeded"

**Solution:**
- Wait 1 minute before trying again
- This is normal - protects against spam
- In production, we'll use Redis for better rate limiting

### Problem: Build fails with import errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

---

## 🚀 **Step 8: Deploy to Vercel (Production)**

### 8.1 Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add ALL variables from `.env.local`
4. **IMPORTANT:** Set `NODE_ENV=production`

### 8.2 Update Supabase RLS Policies

For production, update the Row Level Security policies:

```sql
-- Allow API to read/write with service role
CREATE POLICY "API can manage all data" ON credit_scores
    FOR ALL
    USING (current_setting('role', true) = 'service_role');
```

### 8.3 Deploy

```bash
git push origin main
```

Vercel will automatically deploy! 🎉

---

## 📚 **API Documentation**

### POST /api/scores/calculate

Calculate credit score for a wallet.

**Request:**
```json
{
  "walletAddress": "0x742d35...",
  "signature": "0x...",
  "message": "Calculate my Eon credit score",
  "recalculate": false  // optional, force recalculation
}
```

**Response:**
```json
{
  "success": true,
  "score": 725,
  "tier": "Gold",
  "breakdown": { ... },
  "sybilResistance": { ... },
  "challengeDeadline": "2025-10-03T15:00:00Z"
}
```

### GET /api/scores/[wallet]

Retrieve cached credit score.

**Response:**
```json
{
  "success": true,
  "score": {
    "value": 725,
    "tier": "Gold",
    "breakdown": { ... }
  },
  "metadata": {
    "lastUpdate": "2025-10-03T14:00:00Z",
    "hoursSinceUpdate": 1.5,
    "isStale": false,
    "finalized": true
  },
  "history": [ ... ],
  "recommendations": [ ... ]
}
```

### GET /api/points/balance/[wallet]

Get Eon Points balance.

**Response:**
```json
{
  "success": true,
  "balance": {
    "total": 1250.50,
    "lender": 800.00,
    "borrower": 400.00,
    "referral": 50.50,
    "bonus": 0
  },
  "multiplier": 5.0,
  "ranking": 42,
  "totalUsers": 1000
}
```

---

## 🎯 **Next Steps**

Now that your backend is set up:

1. ✅ Test score calculation with your wallet
2. ✅ Verify data appears in Supabase
3. ✅ Explore the analytics views
4. 📝 Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full picture
5. 🏗️ Start on Phase 1 Week 3: Enhanced Credit Model v1.1

---

## 🆘 **Need Help?**

- **Documentation:** Check [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)
- **Issues:** Open a GitHub issue with the `backend` label
- **Supabase Docs:** [https://supabase.com/docs](https://supabase.com/docs)
- **Database Schema:** See comments in `supabase/schema.sql`

---

**You're all set! The backend is ready to power Eon Protocol. Let's build! 🚀**
