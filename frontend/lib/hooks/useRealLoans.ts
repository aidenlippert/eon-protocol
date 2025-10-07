import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';

const CREDIT_VAULT_V3 = process.env.NEXT_PUBLIC_CREDIT_VAULT_V3 as `0x${string}`;

const VAULT_ABI = [
  {
    inputs: [{ name: 'borrower', type: 'address' }],
    name: 'getUserLoans',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
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
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'loans',
    outputs: [
      { name: 'borrower', type: 'address' },
      { name: 'collateralToken', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principalUsd18', type: 'uint256' },
      { name: 'interestRateBps', type: 'uint16' },
      { name: 'startTime', type: 'uint64' },
      { name: 'lastInterestUpdate', type: 'uint64' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to get user's active loans from CreditVaultV3
 */
export function useUserLoans(address?: string) {
  const { data: loanIds, isLoading: isLoadingIds } = useReadContract({
    address: CREDIT_VAULT_V3,
    abi: VAULT_ABI,
    functionName: 'getUserLoans',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  return {
    loanIds: loanIds || [],
    isLoading: isLoadingIds,
    hasLoans: (loanIds || []).length > 0,
  };
}

/**
 * Hook to get loan details
 */
export function useLoanDetails(loanId: number) {
  const { data: loanData, isLoading: isLoadingLoan } = useReadContract({
    address: CREDIT_VAULT_V3,
    abi: VAULT_ABI,
    functionName: 'loans',
    args: [BigInt(loanId)],
    query: {
      enabled: loanId > 0,
      refetchInterval: 10000,
    },
  });

  const { data: currentDebt, isLoading: isLoadingDebt } = useReadContract({
    address: CREDIT_VAULT_V3,
    abi: VAULT_ABI,
    functionName: 'calculateDebt',
    args: [BigInt(loanId)],
    query: {
      enabled: loanId > 0,
      refetchInterval: 10000,
    },
  });

  if (!loanData) {
    return { isLoading: isLoadingLoan || isLoadingDebt, loan: null };
  }

  const [borrower, collateralToken, collateralAmount, principalUsd18, interestRateBps, startTime, lastInterestUpdate, active] = loanData;

  return {
    isLoading: isLoadingLoan || isLoadingDebt,
    loan: {
      id: loanId,
      borrower,
      collateralToken,
      collateralAmount: formatUnits(collateralAmount, 18),
      principal: formatUnits(principalUsd18, 18),
      currentDebt: currentDebt ? formatUnits(currentDebt, 18) : '0',
      apr: (Number(interestRateBps) / 100).toFixed(1),
      startTime: new Date(Number(startTime) * 1000),
      active,
    },
  };
}

/**
 * Hook to get all user loans with details
 */
export function useUserLoansWithDetails(address?: string) {
  const { loanIds, isLoading: isLoadingIds } = useUserLoans(address);

  // For now, return basic data
  // In production, you'd batch-fetch all loan details
  return {
    isLoading: isLoadingIds,
    loans: loanIds.map((id) => Number(id)),
    count: loanIds.length,
  };
}
