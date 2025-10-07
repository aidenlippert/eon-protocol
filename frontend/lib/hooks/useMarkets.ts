import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits } from 'viem';

const CREDIT_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CREDIT_VAULT_V3 as `0x${string}`;
const INTEREST_RATE_MODEL_ADDRESS = process.env.NEXT_PUBLIC_INTEREST_RATE_MODEL as `0x${string}`;

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
  {
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'amountUsd18', type: 'uint256' },
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'calculateDebt',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'assets',
    outputs: [
      { name: 'allowed', type: 'bool' },
      { name: 'priceFeed', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const INTEREST_RATE_ABI = [
  {
    inputs: [
      { name: 'cash', type: 'uint256' },
      { name: 'borrows', type: 'uint256' },
      { name: 'reserves', type: 'uint256' },
    ],
    name: 'getBorrowRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'cash', type: 'uint256' },
      { name: 'borrows', type: 'uint256' },
      { name: 'reserves', type: 'uint256' },
    ],
    name: 'getSupplyRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'cash', type: 'uint256' },
      { name: 'borrows', type: 'uint256' },
      { name: 'reserves', type: 'uint256' },
    ],
    name: 'getUtilizationRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to get borrow APY for a market
 */
export function useBorrowAPY(cash: bigint, borrows: bigint, reserves: bigint) {
  return useReadContract({
    address: INTEREST_RATE_MODEL_ADDRESS,
    abi: INTEREST_RATE_ABI,
    functionName: 'getBorrowRate',
    args: [cash, borrows, reserves],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get supply APY for a market
 */
export function useSupplyAPY(cash: bigint, borrows: bigint, reserves: bigint) {
  return useReadContract({
    address: INTEREST_RATE_MODEL_ADDRESS,
    abi: INTEREST_RATE_ABI,
    functionName: 'getSupplyRate',
    args: [cash, borrows, reserves],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get utilization rate for a market
 */
export function useUtilizationRate(cash: bigint, borrows: bigint, reserves: bigint) {
  return useReadContract({
    address: INTEREST_RATE_MODEL_ADDRESS,
    abi: INTEREST_RATE_ABI,
    functionName: 'getUtilizationRate',
    args: [cash, borrows, reserves],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to check if asset is allowed as collateral
 */
export function useAssetInfo(tokenAddress: string) {
  return useReadContract({
    address: CREDIT_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'assets',
    args: [tokenAddress as `0x${string}`],
    query: {
      refetchInterval: 60000, // Refetch every minute
    },
  });
}

/**
 * Hook to borrow USDC against collateral
 */
export function useBorrow() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const borrow = (collateralToken: string, collateralAmount: string, borrowAmountUSD: string) => {
    writeContract({
      address: CREDIT_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'borrow',
      args: [
        collateralToken as `0x${string}`,
        parseEther(collateralAmount),
        parseUnits(borrowAmountUSD, 18),
      ],
    });
  };

  return {
    borrow,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to repay loan
 */
export function useRepay() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const repay = (loanId: number, repayAmountUSD: string) => {
    writeContract({
      address: CREDIT_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'repay',
      args: [BigInt(loanId), parseUnits(repayAmountUSD, 18)],
    });
  };

  return {
    repay,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to calculate current debt for a loan
 */
export function useLoanDebt(loanId: number) {
  return useReadContract({
    address: CREDIT_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'calculateDebt',
    args: [BigInt(loanId)],
    query: {
      enabled: loanId > 0,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });
}

/**
 * Helper function to convert APY from contract (per year) to percentage
 */
export function formatAPY(apyPerYear: bigint): string {
  // Contract returns APY as basis points (1e18 = 100%)
  const percentage = Number(apyPerYear) / 1e16; // Convert to percentage
  return percentage.toFixed(2) + '%';
}

/**
 * Helper function to convert utilization rate to percentage
 */
export function formatUtilization(utilizationRate: bigint): string {
  // Contract returns utilization as basis points (1e18 = 100%)
  const percentage = Number(utilizationRate) / 1e16; // Convert to percentage
  return percentage.toFixed(1) + '%';
}
