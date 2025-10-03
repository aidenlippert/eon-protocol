# Schema Deployment Guide

## Quick Deploy (5 minutes)

Your Supabase project is ready! Follow these steps to deploy the database schema:

### Step 1: Open SQL Editor

Go to: **https://supabase.com/dashboard/project/jsjfguvsblwvkpzvytbk/sql/new**

(Or navigate: Your Project → SQL Editor → New Query)

### Step 2: Copy Schema

Open `supabase/schema.sql` in this repository and copy the entire contents.

### Step 3: Execute

1. Paste the SQL into the SQL Editor
2. Click **"Run"** button (or press Cmd/Ctrl + Enter)
3. Wait ~30 seconds for execution

### Step 4: Verify

After execution completes, verify the tables were created:

1. Go to **Table Editor** in the sidebar
2. You should see 12 tables:
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
   - `wallets` (used by triggers)

### Step 5: Test Connection

Run this command to verify your local environment can connect:

```bash
npm run test:db
```

## Alternative: psql CLI Method

If you prefer command-line deployment:

1. **Get Connection String**:
   - Go to: Project Settings → Database
   - Copy the connection string (includes password)

2. **Deploy**:
   ```bash
   psql "your-connection-string-here" -f supabase/schema.sql
   ```

## What the Schema Includes

- ✅ **12 tables** with proper constraints and indexes
- ✅ **Row Level Security (RLS)** policies for data protection
- ✅ **Triggers** for auto-updating timestamps
- ✅ **Views** for analytics (leaderboard, protocol_health)
- ✅ **Seed data** for testing (5 sample wallets with scores)
- ✅ **Functions** for common operations

## Expected Output

You should see output like:

```
CREATE EXTENSION
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
CREATE POLICY
INSERT 0 5
```

If you see errors about "already exists", that's normal on re-runs.

## Troubleshooting

**Error: "permission denied"**
- Make sure you're using the service_role key, not the anon key

**Error: "syntax error"**
- Make sure you copied the entire schema file
- Check that no characters were corrupted during copy/paste

**Tables not appearing**
- Refresh the Table Editor page
- Check the SQL Editor output for errors

## Next Steps

After schema deployment:

1. ✅ Verify tables in Table Editor
2. 🔄 Run data ingestion script (`npm run ingest:wallets`)
3. 🧪 Test API endpoints
4. 📊 Check analytics views work

## Need Help?

- **Supabase Docs**: https://supabase.com/docs/guides/database
- **SQL Editor Guide**: https://supabase.com/docs/guides/database/overview#the-sql-editor
- **Schema File**: `supabase/schema.sql`
