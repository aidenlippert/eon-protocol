/**
 * GET /api/scores/[wallet]
 * Retrieve cached credit score for a wallet
 *
 * This route returns:
 * - Current credit score and tier
 * - Detailed breakdown
 * - Sybil adjustments
 * - History
 * - Challenge status
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet: walletAddress } = await params;

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Fetch credit score
    const { data: score, error: scoreError } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (scoreError) {
      if (scoreError.code === 'PGRST116') {
        // Not found
        return NextResponse.json(
          {
            error: 'Credit score not found',
            message: 'This wallet has not been scored yet. Call POST /api/scores/calculate to generate a score.',
          },
          { status: 404 }
        );
      }

      console.error('Database error:', scoreError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // Fetch score history (last 5 changes)
    const { data: history } = await supabase
      .from('score_history')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('recorded_at', { ascending: false })
      .limit(5);

    // Check for active challenges
    const { data: challenges } = await supabase
      .from('score_challenges')
      .select('*')
      .eq('challenged_wallet', walletAddress.toLowerCase())
      .eq('status', 'pending');

    // Calculate time since last update
    const lastUpdate = new Date(score.updated_at);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    // Check if score is stale (>7 days)
    const isStale = hoursSinceUpdate > 168; // 7 days

    // Check if challenge period is over
    const challengeDeadline = score.challenge_deadline ? new Date(score.challenge_deadline) : null;
    const canFinalize = challengeDeadline && now > challengeDeadline && !score.finalized;

    return NextResponse.json({
      success: true,
      score: {
        value: score.score,
        tier: score.tier,
        breakdown: score.breakdown,
        sybilAdjustments: score.sybil_adjustments,
      },
      metadata: {
        lastUpdate: score.updated_at,
        hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10,
        isStale,
        finalized: score.finalized,
        canFinalize,
        challengeDeadline: score.challenge_deadline,
        merkleRoot: score.merkle_root,
        onChainTxHash: score.on_chain_tx_hash,
        calculationVersion: score.calculation_version,
      },
      history: history || [],
      activeChallenges: challenges || [],
      recommendations: getRecommendations(score.score, isStale),
    });

  } catch (error) {
    console.error('Error fetching credit score:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate recommendations based on score and freshness
 */
function getRecommendations(score: number, isStale: boolean): string[] {
  const recommendations: string[] = [];

  if (isStale) {
    recommendations.push('📅 Your score is over 7 days old. Consider recalculating to reflect recent activity.');
  }

  if (score < 580) {
    recommendations.push('📈 Complete KYC verification to earn +100-150 points and move up a tier.');
    recommendations.push('💰 Make on-time loan repayments to improve your payment history score (35% weight).');
    recommendations.push('🔗 Link additional wallets to earn bundling bonus (+20 points).');
  } else if (score < 670) {
    recommendations.push('🎯 Keep credit utilization below 30% to maximize your score (30% weight).');
    recommendations.push('🏛️ Participate in DAO governance to improve reputation score.');
  } else if (score < 800) {
    recommendations.push('🌐 Use protocols across multiple chains for cross-chain bonus (+30 points).');
    recommendations.push('💎 Hold blue-chip assets (ETH, BTC, major governance tokens) for asset quality bonus.');
  } else {
    recommendations.push('⭐ Congratulations! You have a Platinum-tier credit score.');
    recommendations.push('🚀 Maintain your excellent borrowing behavior to keep your high score.');
  }

  return recommendations;
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
