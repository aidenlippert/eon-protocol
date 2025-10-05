import { NextRequest, NextResponse } from 'next/server';
import { isAddress, parseEther } from 'viem';

/**
 * @title Borrow Estimate API
 * @notice Calculate required collateral for a loan based on score/tier
 * @dev Returns collateral needed, LTV, and user balance check
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, principalUSD, collateralToken = 'ETH' } = body;

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (!principalUSD || principalUSD <= 0) {
      return NextResponse.json({ error: 'Invalid principal amount' }, { status: 400 });
    }

    // Get user's credit score to determine LTV
    // Use VERCEL_URL (server-side) or fallback to localhost
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    console.log('[Estimate API] Fetching score from:', `${baseUrl}/api/score/${wallet}`);
    console.log('[Estimate API] VERCEL_URL:', process.env.VERCEL_URL);

    const scoreResponse = await fetch(`${baseUrl}/api/score/${wallet}`);

    console.log('[Estimate API] Score response status:', scoreResponse.status);

    if (!scoreResponse.ok) {
      const errorText = await scoreResponse.text();
      console.error('[Estimate API] Score fetch failed:', errorText);
      return NextResponse.json({
        error: 'Failed to fetch credit score',
        details: errorText,
        url: `${baseUrl}/api/score/${wallet}`
      }, { status: 500 });
    }

    const scoreData = await scoreResponse.json();
    const { score, tier } = scoreData;

    // LTV based on tier (lower score = more collateral needed)
    const ltvByTier: Record<string, number> = {
      Platinum: 0.80, // 80% LTV (need 125% collateral)
      Gold: 0.70, // 70% LTV (need 143% collateral)
      Silver: 0.60, // 60% LTV (need 167% collateral)
      Bronze: 0.50, // 50% LTV (need 200% collateral)
    };

    const maxLTV = ltvByTier[tier] || 0.50;

    // Calculate required collateral
    // If LTV = 60%, borrow $100 requires $167 collateral ($100 / 0.6)
    const collateralRequiredUSD = principalUSD / maxLTV;

    // Fetch ETH price (simplified - use oracle in production)
    const ethPriceUSD = 2500; // TODO: Fetch from Chainlink or CoinGecko

    const collateralRequiredETH = collateralRequiredUSD / ethPriceUSD;

    // Get user's balance
    const { getWalletBalance } = await import('@/lib/blockchain');
    const userBalance = await getWalletBalance(wallet);
    const userBalanceETH = parseFloat(userBalance);

    const hasEnoughBalance = userBalanceETH >= collateralRequiredETH;

    // Calculate health factor after loan
    const healthFactor = collateralRequiredUSD / principalUSD;

    // Interest rate based on score (lower score = higher APR)
    const baseAPR = 5.0; // 5% base
    const scorePenalty = Math.max(0, (700 - score) / 100) * 0.5; // +0.5% per 100pts below 700
    const apr = baseAPR + scorePenalty;

    return NextResponse.json({
      principal: {
        usd: principalUSD,
        token: 'USDC', // Or whatever stablecoin you use
      },
      collateral: {
        requiredUSD: collateralRequiredUSD,
        requiredETH: collateralRequiredETH,
        token: collateralToken,
      },
      userBalance: {
        eth: userBalanceETH,
        hasEnough: hasEnoughBalance,
        shortfall: hasEnoughBalance ? 0 : collateralRequiredETH - userBalanceETH,
      },
      loanTerms: {
        maxLTV,
        healthFactor,
        apr,
        tier,
        score,
      },
      nextSteps: hasEnoughBalance
        ? ['Approve collateral transfer', 'Deposit collateral', 'Borrow principal']
        : ['Insufficient balance - add more ETH to wallet'],
    });
  } catch (error: any) {
    console.error('[Borrow Estimate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to estimate borrow', message: error.message },
      { status: 500 }
    );
  }
}
