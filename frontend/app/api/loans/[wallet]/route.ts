import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';

const REGISTRY_ABI = [
  {
    inputs: [{ name: 'borrower', type: 'address' }],
    name: 'getUserLoans',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'getLoan',
    outputs: [
      {
        components: [
          { name: 'loanId', type: 'uint256' },
          { name: 'borrower', type: 'address' },
          { name: 'principalUsd18', type: 'uint256' },
          { name: 'repaidUsd18', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'lender', type: 'address' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const VAULT_ABI = [
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'calculateDebt',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'vaultLoans',
    outputs: [
      {
        components: [
          { name: 'collateralToken', type: 'address' },
          { name: 'collateralAmount', type: 'uint256' },
          { name: 'aprBps', type: 'uint16' },
          { name: 'startTimestamp', type: 'uint256' },
          { name: 'graceStart', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

export async function GET(request: NextRequest, { params }: { params: { wallet: string } }) {
  try {
    const { wallet } = params;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Get loan IDs from registry
    const loanIds = (await client.readContract({
      address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: 'getUserLoans',
      args: [wallet as `0x${string}`],
    })) as bigint[];

    if (!loanIds || loanIds.length === 0) {
      return NextResponse.json({ loans: [] });
    }

    // Fetch loan details in parallel
    const loanDataPromises = loanIds.map(async (loanId) => {
      try {
        // Get loan record from registry
        const loanRecord = (await client.readContract({
          address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: 'getLoan',
          args: [loanId],
        })) as any;

        // Get vault data
        const vaultData = (await client.readContract({
          address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'vaultLoans',
          args: [loanId],
        })) as any;

        // Get current debt
        const currentDebt = (await client.readContract({
          address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'calculateDebt',
          args: [loanId],
        })) as bigint;

        // Parse loan status (0=Unknown, 1=Active, 2=Repaid, 3=Liquidated)
        const statusMap = ['Unknown', 'Active', 'Repaid', 'Liquidated'];
        const status = statusMap[loanRecord.status] || 'Unknown';

        return {
          id: loanId.toString(),
          borrower: loanRecord.borrower,
          principalUsd18: loanRecord.principalUsd18.toString(),
          repaidUsd18: loanRecord.repaidUsd18.toString(),
          timestamp: loanRecord.timestamp.toString(),
          status,
          collateralToken: vaultData.collateralToken,
          collateralAmount: vaultData.collateralAmount.toString(),
          aprBps: vaultData.aprBps,
          currentDebt: currentDebt.toString(),
          healthFactor: calculateHealthFactor(
            vaultData.collateralAmount,
            currentDebt
          ),
        };
      } catch (error) {
        console.error(`[Loans API] Error fetching loan ${loanId}:`, error);
        return null;
      }
    });

    const loans = (await Promise.all(loanDataPromises)).filter((loan) => loan !== null);

    return NextResponse.json({ loans });
  } catch (error: any) {
    console.error('[Loans API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans', message: error.message },
      { status: 500 }
    );
  }
}

function calculateHealthFactor(collateralAmount: bigint, debtUsd18: bigint): string {
  if (debtUsd18 === 0n) return '∞';

  // Assume ETH price = $2500
  const ethPrice = 2500;
  const collateralETH = parseFloat(formatEther(collateralAmount));
  const collateralUSD = collateralETH * ethPrice;
  const debtUSD = parseFloat(formatUnits(debtUsd18, 18));

  const healthFactor = collateralUSD / debtUSD;
  return healthFactor.toFixed(2);
}
