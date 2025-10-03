#!/usr/bin/env node
/**
 * Wallet Data Ingestion Script
 * Populates the database with diverse test wallets and their credit scores
 *
 * This script:
 * 1. Selects 10-20 diverse wallets (whale, DAO delegate, new user, etc.)
 * 2. Calculates credit scores for each using the backend scoring engine
 * 3. Stores results in Supabase
 * 4. Awards initial Eon Points based on activity
 * 5. Can run continuously in background for live data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Curated list of diverse Arbitrum wallets for testing
const TEST_WALLETS = [
  // Whale wallets (high balance, long history)
  {
    address: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
    description: 'Arbitrum whale (GMX treasury)',
    expectedTier: 'Platinum'
  },
  {
    address: '0x1111111254fb6c44bAC0beD2854e76F90643097d',
    description: '1inch router (high activity)',
    expectedTier: 'Platinum'
  },

  // DAO participants (governance activity)
  {
    address: '0xF89d7b9c864f589bbF53a82105107622B35EaA40',
    description: 'Active Arbitrum DAO delegate',
    expectedTier: 'Gold'
  },
  {
    address: '0x0E5011001cF9c89b0259BC3B050785067495eBf5',
    description: 'Arbitrum Foundation multisig',
    expectedTier: 'Platinum'
  },

  // DeFi power users (lending, borrowing, liquidity)
  {
    address: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    description: 'Balancer Vault (DeFi protocol)',
    expectedTier: 'Platinum'
  },
  {
    address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    description: 'Uniswap V3 Router 2',
    expectedTier: 'Platinum'
  },

  // Medium-tier users (moderate activity)
  {
    address: '0x7D2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
    description: 'Aave lending pool (Ethereum)',
    expectedTier: 'Gold'
  },
  {
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    description: 'ARB token contract',
    expectedTier: 'Gold'
  },

  // Newer users (shorter history)
  {
    address: '0x1234567890123456789012345678901234567890',
    description: 'Test wallet - new user (will likely fail)',
    expectedTier: 'Bronze'
  },

  // Dev wallet (for testing your own address)
  {
    address: '0x0000000000000000000000000000000000000000',
    description: 'Zero address (negative test)',
    expectedTier: 'Bronze'
  }
];

/**
 * Mock credit score calculation
 * In production, this would call the actual backend scoring API
 */
async function calculateCreditScore(walletAddress) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock score based on wallet characteristics
  // In production: const response = await fetch('/api/scores/calculate', { ... });
  const mockScores = {
    '0x489ee077994B6658eAfA855C308275EAd8097C4A': { score: 820, tier: 'Platinum' },
    '0x1111111254fb6c44bAC0beD2854e76F90643097d': { score: 810, tier: 'Platinum' },
    '0xF89d7b9c864f589bbF53a82105107622B35EaA40': { score: 750, tier: 'Gold' },
    '0x0E5011001cF9c89b0259BC3B050785067495eBf5': { score: 840, tier: 'Platinum' },
    '0xBA12222222228d8Ba445958a75a0704d566BF2C8': { score: 830, tier: 'Platinum' },
    '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45': { score: 825, tier: 'Platinum' },
    '0x7D2768dE32b0b80b7a3454c06BdAc94A69DDc7A9': { score: 720, tier: 'Gold' },
    '0x912CE59144191C1204E64559FE8253a0e49E6548': { score: 710, tier: 'Gold' },
    '0x1234567890123456789012345678901234567890': { score: 450, tier: 'Bronze' },
    '0x0000000000000000000000000000000000000000': { score: 300, tier: 'Bronze' }
  };

  const result = mockScores[walletAddress] || { score: 600, tier: 'Silver' };

  return {
    score: result.score,
    tier: result.tier,
    breakdown: {
      paymentHistory: { score: 85, weight: 30, evidence: { onTimePayments: 95, totalLoans: 12 } },
      creditUtilization: { score: 78, weight: 25, evidence: { avgUtilization: 22 } },
      historyLength: { score: 90, weight: 15, evidence: { accountAge: 730 } },
      creditMix: { score: 82, weight: 12, evidence: { protocols: 8 } },
      newCredit: { score: 75, weight: 8, evidence: { recentInquiries: 3 } },
      onChainReputation: { score: 88, weight: 10, evidence: { daoVotes: 15 } },
      assetHoldings: { score: 92, weight: 5, evidence: { diversification: 0.85 } }
    },
    sybilAdjustments: {
      walletAgePenalty: 0,
      humanityBonus: 50,
      stakingBonus: 25
    }
  };
}

/**
 * Calculate initial Eon Points based on score and activity
 */
function calculateInitialPoints(scoreData) {
  const basePoints = (scoreData.score - 300) * 10; // 0-5500 points based on score
  const tierMultiplier = {
    'Bronze': 1.0,
    'Silver': 1.25,
    'Gold': 1.5,
    'Platinum': 2.0
  }[scoreData.tier] || 1.0;

  return Math.round(basePoints * tierMultiplier);
}

/**
 * Ingest a single wallet
 */
async function ingestWallet(wallet) {
  const { address, description, expectedTier } = wallet;
  const normalizedAddress = address.toLowerCase();

  console.log(`\n🔍 Processing: ${description}`);
  console.log(`   Address: ${address}`);

  try {
    // Step 1: Calculate credit score
    console.log('   ⚙️  Calculating credit score...');
    const scoreData = await calculateCreditScore(address);
    console.log(`   📊 Score: ${scoreData.score} (${scoreData.tier})`);

    // Step 2: Store in credit_scores table
    const { data: insertedScore, error: scoreError } = await supabase
      .from('credit_scores')
      .upsert({
        wallet_address: normalizedAddress,
        score: scoreData.score,
        tier: scoreData.tier,
        breakdown: scoreData.breakdown,
        sybil_adjustments: scoreData.sybilAdjustments,
        challenge_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        finalized: false,
        calculation_version: 'v1.0',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (scoreError) throw scoreError;
    console.log(`   ✅ Credit score stored (ID: ${insertedScore.id.substring(0, 8)}...)`);

    // Step 3: Create score history entry
    const { error: historyError } = await supabase
      .from('score_history')
      .insert({
        wallet_address: normalizedAddress,
        score: scoreData.score,
        tier: scoreData.tier,
        change_reason: 'Initial calculation',
        recorded_at: new Date().toISOString()
      });

    if (historyError) throw historyError;

    // Step 4: Initialize Eon Points
    const initialPoints = calculateInitialPoints(scoreData);
    const { data: insertedPoints, error: pointsError } = await supabase
      .from('eon_points')
      .upsert({
        wallet_address: normalizedAddress,
        total_points: initialPoints,
        lender_points: Math.round(initialPoints * 0.6),
        borrower_points: Math.round(initialPoints * 0.4),
        referral_points: 0,
        current_multiplier: 1.0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (pointsError) throw pointsError;
    console.log(`   🎁 Eon Points: ${initialPoints} (ID: ${insertedPoints.id.substring(0, 8)}...)`);

    // Step 5: Record points transaction
    const { error: txError } = await supabase
      .from('points_transactions')
      .insert({
        wallet_address: normalizedAddress,
        amount: initialPoints,
        transaction_type: 'score_calculation',
        description: 'Initial score calculation bonus',
        created_at: new Date().toISOString()
      });

    if (txError) throw txError;

    console.log(`   ✅ Wallet ingestion complete!`);

    return {
      success: true,
      address,
      score: scoreData.score,
      tier: scoreData.tier,
      points: initialPoints
    };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return {
      success: false,
      address,
      error: error.message
    };
  }
}

/**
 * Main ingestion workflow
 */
async function main() {
  console.log('🚀 Eon Protocol - Wallet Data Ingestion\n');
  console.log(`📊 Ingesting ${TEST_WALLETS.length} test wallets...\n`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const wallet of TEST_WALLETS) {
    const result = await ingestWallet(wallet);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Ingestion Summary\n');
  console.log(`✅ Success: ${successCount}/${TEST_WALLETS.length}`);
  console.log(`❌ Errors: ${errorCount}/${TEST_WALLETS.length}\n`);

  // Show leaderboard
  console.log('🏆 Leaderboard (Top 5):\n');
  const successful = results.filter(r => r.success).sort((a, b) => b.score - a.score);
  successful.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.address.substring(0, 10)}... - ${r.score} (${r.tier}) - ${r.points} pts`);
  });

  console.log('\n🎉 Data ingestion complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Run: npm run test:db');
  console.log('   2. Visit Supabase dashboard to view data');
  console.log('   3. Test API endpoints: curl http://localhost:3000/api/scores/[wallet]\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
