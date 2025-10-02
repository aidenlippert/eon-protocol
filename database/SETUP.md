# 🗄️ Eon Protocol Database Setup

**Copy/paste Supabase setup - 5 minutes**

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - **Name:** eon-protocol
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
4. Wait 2 minutes for provisioning

## Step 2: Run Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy entire contents of `schema.sql`
4. Paste and click **Run**

**Expected output:**
```
Success. No rows returned.
```

You should now have:
- ✅ 5 tables (claims, reputation, loans, challenges, checkpoints)
- ✅ 2 views (credit_profiles, protocol_stats)
- ✅ 2 functions (update_reputation_score, get_decayed_score)
- ✅ Row-level security policies

## Step 3: Get Connection URL

1. Go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Copy **URI** (starts with `postgresql://`)
4. Save for indexer `.env`

**Format:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Step 4: Get Service Role Key

1. Go to **Settings** → **API**
2. Copy **service_role** key (NOT anon key)
3. Save for indexer `.env`

⚠️ **IMPORTANT:** Service role bypasses RLS (needed for indexer writes)

## Step 5: Test Connection

In SQL Editor, run:
```sql
SELECT * FROM protocol_stats;
```

**Expected output:**
```
total_claims_accepted | 0
total_claims_rejected | 0
total_claims_pending  | 0
total_active_loans    | 0
total_users          | 0
avg_reputation_score | null
total_tvl            | 0
total_bad_debt       | 0
```

## Indexer Environment Variables

Add to `/indexer/.env`:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE-ROLE-KEY]
```

## Frontend Environment Variables

Add to `/frontend/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON-KEY]
```

## Query Examples

### Get user credit profile
```sql
SELECT * FROM credit_profiles WHERE user_address = '0x742d35Cc...';
```

### Get top reputation holders
```sql
SELECT user_address, score, risk_tier, ltv
FROM credit_profiles
ORDER BY score DESC
LIMIT 10;
```

### Get protocol stats
```sql
SELECT * FROM protocol_stats;
```

### Get recent claims
```sql
SELECT id, user_address, status, reputation_score, created_at
FROM claims
ORDER BY created_at DESC
LIMIT 20;
```

## Maintenance

### Reset database (DEV ONLY)
```sql
TRUNCATE claims, reputation, loans, challenges RESTART IDENTITY CASCADE;
UPDATE checkpoints SET block_number = 0 WHERE id = 'scanner';
```

### Backup database
Settings → Database → Backups → Create Backup

## Troubleshooting

**Error: relation "claims" does not exist**
→ Schema not run. Go to SQL Editor and run schema.sql

**Error: permission denied**
→ Using anon key instead of service_role key. Check .env

**Error: connection refused**
→ Wrong DATABASE_URL. Check Settings → Database → Connection string

## Cost

**Free tier:**
- 500 MB database
- Unlimited API requests
- 50K monthly active users

**Upgrade ($25/month) when:**
- Database >500 MB
- Need daily backups
- >50K users

## Security Notes

✅ **Row Level Security:** Enabled on all tables
- Public can READ all data (blockchain is public)
- Only service_role can WRITE (indexer only)

✅ **No sensitive data:** All data is public blockchain history

✅ **API rate limiting:** 100 req/sec on free tier

## Next Steps

After database setup:
1. ✅ Deploy indexer (writes to Supabase)
2. ✅ Build frontend (reads from Supabase)
3. ✅ Monitor with Supabase dashboard
