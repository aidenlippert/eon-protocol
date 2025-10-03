#!/usr/bin/env node
/**
 * Database Connection Test
 * Verifies that the Supabase connection is working
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 Testing Supabase Connection\n');
console.log(`📍 URL: ${supabaseUrl}\n`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  console.error('   Please check your .env.local file\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('1️⃣  Testing connection...');

    // Try to query credit_scores table
    const { data, error, count } = await supabase
      .from('credit_scores')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('relation "credit_scores" does not exist')) {
        console.log('   ⚠️  Connected, but schema not deployed yet');
        console.log('   📝 Please deploy the schema first (see DEPLOY_SCHEMA.md)\n');
        return false;
      }
      throw error;
    }

    console.log('   ✅ Connection successful!\n');

    console.log('2️⃣  Checking tables...');

    // Check all expected tables
    const tables = [
      'credit_scores',
      'eon_points',
      'kyc_verifications',
      'lending_positions',
      'linked_wallets',
      'liquidation_events',
      'points_transactions',
      'protocol_metrics',
      'referrals',
      'score_challenges',
      'score_history'
    ];

    let foundTables = 0;
    let missingTables = [];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        foundTables++;
      } else if (!error.message.includes('does not exist')) {
        missingTables.push(table);
      }
    }

    console.log(`   ✅ Found ${foundTables}/${tables.length} tables\n`);

    if (missingTables.length > 0) {
      console.log('   ⚠️  Missing tables:');
      missingTables.forEach(t => console.log(`      - ${t}`));
      console.log();
    }

    console.log('3️⃣  Checking data...');
    const { data: scores, count: scoreCount } = await supabase
      .from('credit_scores')
      .select('*', { count: 'exact' });

    console.log(`   📊 Credit scores: ${scoreCount || 0} records`);

    const { data: points, count: pointsCount } = await supabase
      .from('eon_points')
      .select('*', { count: 'exact' });

    console.log(`   📊 Eon points: ${pointsCount || 0} records\n`);

    console.log('🎉 Database is ready!\n');

    if (scoreCount === 0) {
      console.log('💡 Next step: Run the data ingestion script');
      console.log('   npm run ingest:wallets\n');
    }

    return true;

  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(`   ${error.message}\n`);
    return false;
  }
}

testConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
