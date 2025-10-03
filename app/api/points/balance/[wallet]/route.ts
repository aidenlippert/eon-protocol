/**
 * GET /api/points/balance/[wallet]
 * Get Eon Points balance and transaction history
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet: walletAddress } = await params;

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Fetch points balance
    const { data: points, error: pointsError } = await supabase
      .from('eon_points')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (pointsError && pointsError.code !== 'PGRST116') {
      console.error('Database error:', pointsError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // If no points entry exists, return zero balance
    if (!points) {
      return NextResponse.json({
        success: true,
        balance: {
          total: 0,
          lender: 0,
          borrower: 0,
          referral: 0,
          bonus: 0,
        },
        multiplier: 1.0,
        claimed: false,
        transactions: [],
        ranking: null,
      });
    }

    // Fetch recent transactions
    const { data: transactions } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(20);

    // Get user's ranking (leaderboard position)
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('wallet_address, total_points')
      .order('total_points', { ascending: false });

    const ranking = leaderboard
      ? leaderboard.findIndex(entry => entry.wallet_address === walletAddress.toLowerCase()) + 1
      : null;

    return NextResponse.json({
      success: true,
      balance: {
        total: parseFloat(points.total_points),
        lender: parseFloat(points.lender_points),
        borrower: parseFloat(points.borrower_points),
        referral: parseFloat(points.referral_points),
        bonus: parseFloat(points.bonus_points),
      },
      multiplier: parseFloat(points.current_multiplier),
      claimed: points.claimed,
      claimedAt: points.claimed_at,
      claimedAmount: points.claimed_amount ? parseFloat(points.claimed_amount) : null,
      transactions: transactions || [],
      ranking,
      totalUsers: leaderboard?.length || 0,
    });

  } catch (error) {
    console.error('Error fetching points balance:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

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
