import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const FLASH_LOAN_VAULT_ADDRESS = process.env.NEXT_PUBLIC_FLASH_LOAN_VAULT as `0x${string}`;

const FLASH_LOAN_ABI = [
  {
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'params', type: 'bytes' },
    ],
    name: 'flashLoanSimple',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'assets', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'params', type: 'bytes' },
    ],
    name: 'flashLoan',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'getMaxFlashLoan',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'getFlashLoanFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FLASH_LOAN_PREMIUM_TOTAL',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'treasury',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'getAvailableLiquidity',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to get maximum flash loan amount for an asset
 */
export function useMaxFlashLoan(assetAddress: string) {
  return useReadContract({
    address: FLASH_LOAN_VAULT_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: 'getMaxFlashLoan',
    args: [assetAddress as `0x${string}`],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get flash loan fee for specific amount
 */
export function useFlashLoanFee(assetAddress: string, amount: bigint) {
  return useReadContract({
    address: FLASH_LOAN_VAULT_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: 'getFlashLoanFee',
    args: [assetAddress as `0x${string}`, amount],
    query: {
      enabled: amount > 0n,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get flash loan premium (0.09%)
 */
export function useFlashLoanPremium() {
  return useReadContract({
    address: FLASH_LOAN_VAULT_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: 'FLASH_LOAN_PREMIUM_TOTAL',
    query: {
      refetchInterval: 60000, // Refetch every minute
    },
  });
}

/**
 * Hook to get available liquidity for flash loans
 */
export function useAvailableLiquidity(assetAddress: string) {
  return useReadContract({
    address: FLASH_LOAN_VAULT_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: 'getAvailableLiquidity',
    args: [assetAddress as `0x${string}`],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get treasury address
 */
export function useTreasury() {
  return useReadContract({
    address: FLASH_LOAN_VAULT_ADDRESS,
    abi: FLASH_LOAN_ABI,
    functionName: 'treasury',
    query: {
      refetchInterval: 60000, // Refetch every minute
    },
  });
}

/**
 * Hook to execute single-asset flash loan
 */
export function useFlashLoanSimple() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const flashLoanSimple = (
    receiverAddress: string,
    assetAddress: string,
    amount: string,
    params: `0x${string}` = '0x'
  ) => {
    writeContract({
      address: FLASH_LOAN_VAULT_ADDRESS,
      abi: FLASH_LOAN_ABI,
      functionName: 'flashLoanSimple',
      args: [receiverAddress as `0x${string}`, assetAddress as `0x${string}`, parseEther(amount), params],
    });
  };

  return {
    flashLoanSimple,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to execute multi-asset flash loan
 */
export function useFlashLoan() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const flashLoan = (
    receiverAddress: string,
    assetAddresses: string[],
    amounts: string[],
    params: `0x${string}` = '0x'
  ) => {
    writeContract({
      address: FLASH_LOAN_VAULT_ADDRESS,
      abi: FLASH_LOAN_ABI,
      functionName: 'flashLoan',
      args: [
        receiverAddress as `0x${string}`,
        assetAddresses as `0x${string}`[],
        amounts.map((amt) => parseEther(amt)),
        params,
      ],
    });
  };

  return {
    flashLoan,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Helper function to calculate flash loan fee
 * Premium is 9 basis points (0.09%)
 */
export function calculateFlashLoanFee(amount: bigint, premium: bigint): bigint {
  const PREMIUM_PRECISION = 10000n;
  return (amount * premium) / PREMIUM_PRECISION;
}

/**
 * Helper function to format flash loan amount with fee
 */
export function formatFlashLoanTotal(amount: bigint, fee: bigint): string {
  const total = amount + fee;
  return (Number(total) / 1e18).toFixed(6);
}
