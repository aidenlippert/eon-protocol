import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, parseEther, encodeFunctionData } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';

/**
 * @title Transaction Prep API
 * @notice Prepares encoded calldata for multi-step borrow flow
 * @dev Returns array of transaction steps (approve → borrow)
 */

const WETH_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const VAULT_ABI = [
  {
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principalUsd18', type: 'uint256' },
    ],
    name: 'borrow',
    outputs: [{ name: 'loanId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface TransactionStep {
  type: 'approve' | 'borrow';
  to: string;
  data: string;
  value: string;
  description: string;
  estimatedGas: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, collateralAmount, principalUSD, collateralToken = 'WETH' } = body;

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (!collateralAmount || collateralAmount <= 0) {
      return NextResponse.json({ error: 'Invalid collateral amount' }, { status: 400 });
    }

    if (!principalUSD || principalUSD <= 0) {
      return NextResponse.json({ error: 'Invalid principal amount' }, { status: 400 });
    }

    const steps: TransactionStep[] = [];
    const vaultAddress = CONTRACT_ADDRESSES[421614].CreditVaultV3;
    const wethAddress = CONTRACT_ADDRESSES[421614].MockWETH;
    const collateralAmountWei = parseEther(collateralAmount.toString());
    const principalUsd18 = parseEther(principalUSD.toString());

    // Create viem client for reading allowance
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(),
    });

    // Check current allowance
    const currentAllowance = (await client.readContract({
      address: wethAddress as `0x${string}`,
      abi: WETH_ABI,
      functionName: 'allowance',
      args: [wallet as `0x${string}`, vaultAddress as `0x${string}`],
    })) as bigint;

    // Step 1: Approve (if needed)
    if (currentAllowance < collateralAmountWei) {
      const approveData = encodeFunctionData({
        abi: WETH_ABI,
        functionName: 'approve',
        args: [vaultAddress as `0x${string}`, collateralAmountWei],
      });

      steps.push({
        type: 'approve',
        to: wethAddress,
        data: approveData,
        value: '0',
        description: `Approve ${collateralAmount} WETH for vault`,
        estimatedGas: 50000,
      });
    }

    // Step 2: Borrow
    const borrowData = encodeFunctionData({
      abi: VAULT_ABI,
      functionName: 'borrow',
      args: [wethAddress as `0x${string}`, collateralAmountWei, principalUsd18],
    });

    steps.push({
      type: 'borrow',
      to: vaultAddress,
      data: borrowData,
      value: '0',
      description: `Borrow $${principalUSD} USDC with ${collateralAmount} WETH collateral`,
      estimatedGas: 350000,
    });

    const totalGas = steps.reduce((sum, step) => sum + step.estimatedGas, 0);

    return NextResponse.json({
      steps,
      needsApproval: currentAllowance < collateralAmountWei,
      totalSteps: steps.length,
      estimatedGas: totalGas,
      collateralToken: wethAddress,
      vaultAddress,
    });
  } catch (error: any) {
    console.error('[Transaction Prep API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare transactions', message: error.message },
      { status: 500 }
    );
  }
}
