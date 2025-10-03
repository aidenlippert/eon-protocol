/**
 * POST /api/scores/calculate
 * Calculate credit score for a wallet and store in database
 *
 * This route:
 * 1. Verifies wallet signature
 * 2. Fetches on-chain data
 * 3. Calculates credit score
 * 4. Stores result in Supabase
 * 5. Returns score + breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeWalletComprehensive } from '@/lib/comprehensive-analyzer';
import { verifyMessage } from 'viem';

// Rate limiting (simple in-memory store)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(address) || [];

  // Filter out old requests
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(address, recentRequests);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, message, recalculate = false } = body;

    // Validation
    if (!walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, signature, message' },
        { status: 400 }
      );
    }

    // Verify wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(walletAddress.toLowerCase())) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    // Verify signature
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    // Check if score already exists and is recent (unless recalculate=true)
    if (!recalculate) {
      const { data: existingScore } = await supabaseAdmin!
        .from('credit_scores')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (existingScore) {
        const lastUpdate = new Date(existingScore.updated_at);
        const now = new Date();
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

        // If updated within last 24 hours, return cached score
        if (hoursSinceUpdate < 24) {
          return NextResponse.json({
            score: existingScore.score,
            tier: existingScore.tier,
            breakdown: existingScore.breakdown,
            sybilAdjustments: existingScore.sybil_adjustments,
            cached: true,
            lastUpdate: existingScore.updated_at,
            message: `Using cached score from ${hoursSinceUpdate.toFixed(1)} hours ago. Use recalculate=true to force update.`
          });
        }
      }
    }

    // Calculate credit score
    console.log(`Calculating credit score for ${walletAddress}...`);

    const scoreData = await analyzeWalletComprehensive(
      walletAddress,
      undefined, // KYC status - will be fetched from DB
      [], // Linked wallets - will be fetched from DB
      undefined, // Staking amount - will be fetched from contract
      true // Enable cross-chain
    );

    // Store in database
    const { data: insertedScore, error: insertError } = await supabaseAdmin!
      .from('credit_scores')
      .upsert(
        {
          wallet_address: walletAddress.toLowerCase(),
          score: scoreData.score,
          tier: scoreData.tier,
          breakdown: scoreData.breakdown,
          sybil_adjustments: scoreData.sybilResistance.adjustments,
          calculation_version: 'v1.1',
          finalized: false, // Will be finalized after challenge period
          challenge_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      )
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to store credit score' },
        { status: 500 }
      );
    }

    // Record in history
    await supabaseAdmin!
      .from('score_history')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        score: scoreData.score,
        tier: scoreData.tier,
        breakdown: scoreData.breakdown,
        change_reason: recalculate ? 'recalculation' : 'initial',
        recorded_at: new Date().toISOString(),
      });

    // Return response
    return NextResponse.json({
      success: true,
      score: scoreData.score,
      tier: scoreData.tier,
      breakdown: scoreData.breakdown,
      sybilResistance: scoreData.sybilResistance,
      crossChain: scoreData.crossChain,
      cached: false,
      calculatedAt: new Date().toISOString(),
      challengeDeadline: insertedScore.challenge_deadline,
      message: 'Credit score calculated successfully. Score will be finalized after 1-hour challenge period.'
    });

  } catch (error) {
    console.error('Error calculating credit score:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
