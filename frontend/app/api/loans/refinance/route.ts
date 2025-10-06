import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const CREDIT_VAULT = process.env.NEXT_PUBLIC_CREDIT_VAULT_ADDRESS as Address;
const SCORE_ORACLE = process.env.NEXT_PUBLIC_SCORE_ORACLE_ADDRESS as Address;

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC),
});

// APR calculation based on score (matches vault logic)
function getAPRFromScore(score: number): number {
  if (score >= 900) return 5.0; // Platinum
  if (score >= 750) return 7.0; // Gold
  if (score >= 600) return 10.0; // Silver
  return 12.0; // Bronze
}

export async function POST(req: NextRequest) {
  try {
    const { loanId, borrower } = await req.json();

    if (!loanId || !borrower) {
      return NextResponse.json(
        { error: 'Missing loanId or borrower' },
        { status: 400 }
      );
    }

    // 1. Fetch current loan details
    const loanData = await publicClient.readContract({
      address: CREDIT_VAULT,
      abi: parseAbi([
        'function loans(uint256) view returns (address borrower, uint256 principalUsd18, uint256 collateralUsd18, uint256 timestamp, bool active, uint256 aprBps)',
      ]),
      functionName: 'loans',
      args: [BigInt(loanId)],
    });

    const [_, principalUsd18, collateralUsd18, __, active, currentAPRBps] = loanData;

    if (!active) {
      return NextResponse.json(
        { error: 'Loan is not active' },
        { status: 400 }
      );
    }

    // 2. Fetch current credit score
    const currentScore = await publicClient.readContract({
      address: SCORE_ORACLE,
      abi: parseAbi(['function getScore(address) view returns (uint256)']),
      functionName: 'getScore',
      args: [borrower as Address],
    });

    const newAPR = getAPRFromScore(Number(currentScore));
    const newAPRBps = Math.floor(newAPR * 100);
    const oldAPR = Number(currentAPRBps) / 100;

    // Check if refinancing makes sense (at least 1% APR improvement)
    if (newAPR >= oldAPR - 1) {
      return NextResponse.json({
        worthIt: false,
        message: 'Score improvement insufficient for refinancing',
        currentAPR: oldAPR,
        potentialAPR: newAPR,
      });
    }

    // 3. Calculate savings
    const principal = Number(principalUsd18) / 1e18;
    const collateral = Number(collateralUsd18) / 1e18;

    // Assume 1 year loan for savings calculation
    const currentInterest = (principal * oldAPR) / 100;
    const newInterest = (principal * newAPR) / 100;
    const annualSavings = currentInterest - newInterest;
    const monthlySavings = annualSavings / 12;

    // 4. Calculate current debt (principal + accrued interest)
    const blockTime = Math.floor(Date.now() / 1000);
    const loanAge = blockTime - Number(__); // timestamp from loan data
    const accruedInterest = (principal * oldAPR * loanAge) / (365 * 24 * 60 * 60 * 100);
    const totalDebt = principal + accruedInterest;

    return NextResponse.json({
      worthIt: true,
      loanId,
      currentAPR: oldAPR,
      newAPR,
      score: Number(currentScore),
      principal,
      collateral,
      totalDebt,
      savings: {
        annual: annualSavings,
        monthly: monthlySavings,
        percentage: ((oldAPR - newAPR) / oldAPR) * 100,
      },
      // Transaction will be encoded by /api/loans/refinance/prepare
    });
  } catch (error: any) {
    console.error('Refinance calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate refinancing terms', details: error.message },
      { status: 500 }
    );
  }
}
