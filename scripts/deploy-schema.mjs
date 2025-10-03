#!/usr/bin/env node
/**
 * Schema Deployment Script
 * Deploys the database schema to Supabase using the service role key
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please set:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🚀 Deploying schema to Supabase...\n');
console.log(`📍 URL: ${supabaseUrl}\n`);

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read SQL schema
const schemaPath = join(__dirname, '..', 'supabase', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

// Split schema into individual statements
// We need to execute them one by one because Supabase's RPC doesn't support multi-statement queries
const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

async function deploySchema() {
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';

    // Skip comments
    if (stmt.startsWith('--')) continue;

    // Extract statement type for logging
    const stmtType = stmt.split(/\s+/)[0].toUpperCase();
    const stmtPreview = stmt.substring(0, 80).replace(/\s+/g, ' ');

    process.stdout.write(`[${i + 1}/${statements.length}] ${stmtType} ${stmtPreview}... `);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });

      if (error) {
        // Some errors are expected (e.g., "already exists" errors on re-runs)
        if (error.message.includes('already exists')) {
          console.log('⚠️  Already exists (skipped)');
        } else {
          console.log(`❌ Error: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log('✅');
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Deployment Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${statements.length}`);

  if (errorCount === 0) {
    console.log('\n🎉 Schema deployed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Visit your Supabase dashboard to verify tables');
    console.log('   2. Run the data ingestion script to populate test data');
    console.log('   3. Test API endpoints with real data\n');
  } else {
    console.log(`\n⚠️  Deployment completed with ${errorCount} errors`);
    console.log('   Please review the errors above and fix any issues.\n');
  }
}

// Note: Supabase doesn't have a built-in exec_sql RPC by default
// We need to use the SQL Editor API instead
async function deploySchemaViaAPI() {
  console.log('⚠️  Direct SQL execution via client is not supported.');
  console.log('📝 Please deploy the schema manually using one of these methods:\n');
  console.log('Method 1: SQL Editor (Recommended)');
  console.log('   1. Go to: https://jsjfguvsblwvkpzvytbk.supabase.co/project/jsjfguvsblwvkpzvytbk/sql/new');
  console.log('   2. Copy the contents of supabase/schema.sql');
  console.log('   3. Paste into the SQL Editor');
  console.log('   4. Click "Run" to execute\n');

  console.log('Method 2: psql CLI');
  console.log('   1. Get your connection string from Supabase dashboard');
  console.log('   2. Run: psql "postgresql://postgres:[YOUR-PASSWORD]@db.jsjfguvsblwvkpzvytbk.supabase.co:5432/postgres" -f supabase/schema.sql\n');

  console.log('Method 3: Supabase CLI (requires separate installation)');
  console.log('   1. Install: https://github.com/supabase/cli#install-the-cli');
  console.log('   2. Run: supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.jsjfguvsblwvkpzvytbk.supabase.co:5432/postgres"\n');
}

deploySchemaViaAPI();
