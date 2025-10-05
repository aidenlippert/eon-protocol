import { NextRequest, NextResponse } from 'next/server';
import { parseEther, parseUnits, isAddress } from 'viem';

/**
 * @title Borrow Prepare API
 * @notice Prepares transaction data for 3-step borrowing flow
 * @dev Returns encoded function calls for approve → deposit → borrow
 *
 * **3-Step Borrowing Flow**:
 * 1. Approve: User approves CreditVault to spend their collateral (ETH/WETH)
 * 2. Deposit: User deposits collateral into CreditVault
 * 3. Borrow: User borrows USDC against their collateral
 *
 * **Security**:
 * - Validates collateral amount > 0
 * - Validates principal amount > 0
 * - Checks wallet address validity
 * - Returns read-only transaction data (no private keys)
 */

// Contract addresses on Arbitrum Sepolia
const CREDIT_VAULT = '0xB1E54fDCf400FB25203801013dfeaD737fBBbd61';
const WETH_ADDRESS = '0x980B62Da83eff3D4576C647993b0c1D7faf17c73'; // Arbitrum Sepolia WETH
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'; // Arbitrum Sepolia USDC

// ABIs for function encoding
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
] as const;

const VAULT_ABI = [
  'function depositCollateral(uint256 amount) external payable',
  'function borrow(uint256 amount) external',
] as const;

interface PrepareRequest {
  wallet: string;
  collateralETH: number; // Amount in ETH
  principalUSD: number; // Amount in USD
}

/**
 * POST /api/borrow/prepare
 * Prepares transaction data for borrowing flow
 */
export async function POST(request: NextRequest) {
  try {
    const body: PrepareRequest = await request.json();
    const { wallet, collateralETH, principalUSD } = body;

    // ==================== VALIDATION ====================

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    if (typeof collateralETH !== 'number' || collateralETH <= 0) {
      return NextResponse.json(
        { error: 'Invalid collateral amount (must be > 0)' },
        { status: 400 }
      );
    }

    if (typeof principalUSD !== 'number' || principalUSD <= 0) {
      return NextResponse.json(
        { error: 'Invalid principal amount (must be > 0)' },
        { status: 400 }
      );
    }

    // ==================== ENCODE TRANSACTIONS ====================

    // Convert amounts to wei/smallest units
    const collateralWei = parseEther(collateralETH.toString());
    const principalWei = parseUnits(principalUSD.toString(), 6); // USDC has 6 decimals

    // Step 1: Approve WETH spending
    // Note: For native ETH, we skip this step (handled by depositCollateral with msg.value)
    // This is here for future WETH support
    const approveData = {
      to: WETH_ADDRESS,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CREDIT_VAULT as `0x${string}`, collateralWei],
      }),
      value: '0x0',
      description: `Approve ${collateralETH} ETH for CreditVault`,
    };

    // Step 2: Deposit collateral
    const depositData = {
      to: CREDIT_VAULT,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'depositCollateral',
        args: [collateralWei],
      }),
      value: collateralWei.toString(), // Send ETH with transaction
      description: `Deposit ${collateralETH} ETH as collateral`,
    };

    // Step 3: Borrow USDC
    const borrowData = {
      to: CREDIT_VAULT,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'borrow',
        args: [principalWei],
      }),
      value: '0x0',
      description: `Borrow $${principalUSD} USDC`,
    };

    // ==================== RESPONSE ====================

    return NextResponse.json({
      success: true,
      transactions: {
        // Step 1: Approve (optional for native ETH, required for WETH)
        approve: {
          ...approveData,
          required: false, // Skip for native ETH deposits
          gasEstimate: 50000,
        },
        // Step 2: Deposit collateral
        deposit: {
          ...depositData,
          required: true,
          gasEstimate: 150000,
        },
        // Step 3: Borrow
        borrow: {
          ...borrowData,
          required: true,
          gasEstimate: 200000,
        },
      },
      summary: {
        collateralETH,
        principalUSD,
        vaultAddress: CREDIT_VAULT,
        estimatedTotalGas: 400000, // ~$1.50 on Arbitrum L2
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Borrow Prepare API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to prepare borrow transactions',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Helper to encode function data (viem-compatible)
function encodeFunctionData({ abi, functionName, args }: any): string {
  // For simplicity, we'll use a basic encoding approach
  // In production, use viem's encodeFunctionData
  const { encodeFunctionData: encode } = require('viem');
  return encode({ abi, functionName, args });
}
