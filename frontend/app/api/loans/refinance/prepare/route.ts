import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, parseAbi, Address } from 'viem';

const CREDIT_VAULT = process.env.NEXT_PUBLIC_CREDIT_VAULT_ADDRESS as Address;

export async function POST(req: NextRequest) {
  try {
    const { loanId, newCollateralAmount } = await req.json();

    if (!loanId) {
      return NextResponse.json({ error: 'Missing loanId' }, { status: 400 });
    }

    // For now, we'll use a simple repay + reborrow pattern
    // In production, this would use Aave/Uniswap flash loans for atomic refinancing

    const steps = [];

    // Step 1: Repay existing loan
    const repayData = encodeFunctionData({
      abi: parseAbi(['function repayLoan(uint256 loanId) external']),
      functionName: 'repayLoan',
      args: [BigInt(loanId)],
    });

    steps.push({
      type: 'repay',
      to: CREDIT_VAULT,
      data: repayData,
      value: '0',
      description: 'Repay current loan',
      estimatedGas: 150000,
    });

    // Step 2: Borrow with new terms (if additional collateral provided)
    if (newCollateralAmount && Number(newCollateralAmount) > 0) {
      const borrowData = encodeFunctionData({
        abi: parseAbi([
          'function borrow(uint256 collateralUsd18, uint256 principalUsd18) external',
        ]),
        functionName: 'borrow',
        args: [
          BigInt(Math.floor(Number(newCollateralAmount) * 1e18)),
          BigInt(0), // Will be calculated by vault based on LTV
        ],
      });

      steps.push({
        type: 'borrow',
        to: CREDIT_VAULT,
        data: borrowData,
        value: '0',
        description: 'Create new loan with improved terms',
        estimatedGas: 350000,
      });
    }

    const totalGas = steps.reduce((sum, step) => sum + step.estimatedGas, 0);

    return NextResponse.json({
      steps,
      totalSteps: steps.length,
      estimatedGas: totalGas,
      flashLoanAvailable: false, // TODO: Implement Aave flash loan integration
      note: 'Requires sufficient funds to repay current loan before reborrowing',
    });
  } catch (error: any) {
    console.error('Refinance preparation error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare refinance transaction', details: error.message },
      { status: 500 }
    );
  }
}
