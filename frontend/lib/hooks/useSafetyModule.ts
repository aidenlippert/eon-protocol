import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const SAFETY_MODULE_ADDRESS = process.env.NEXT_PUBLIC_SAFETY_MODULE as `0x${string}`;

const SAFETY_MODULE_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'activateCooldown',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getStakerInfo',
    outputs: [
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'pendingRewards', type: 'uint256' },
      { name: 'cooldownStart', type: 'uint256' },
      { name: 'cooldownEnd', type: 'uint256' },
      { name: 'canUnstake', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTVL',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentAPY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalStaked',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to get staker information
 */
export function useStakerInfo(address?: string) {
  return useReadContract({
    address: SAFETY_MODULE_ADDRESS,
    abi: SAFETY_MODULE_ABI,
    functionName: 'getStakerInfo',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });
}

/**
 * Hook to get Safety Module TVL
 */
export function useSafetyModuleTVL() {
  return useReadContract({
    address: SAFETY_MODULE_ADDRESS,
    abi: SAFETY_MODULE_ABI,
    functionName: 'getTVL',
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}

/**
 * Hook to get current staking APY
 */
export function useStakingAPY() {
  return useReadContract({
    address: SAFETY_MODULE_ADDRESS,
    abi: SAFETY_MODULE_ABI,
    functionName: 'getCurrentAPY',
    query: {
      refetchInterval: 60000, // Refetch every minute
    },
  });
}

/**
 * Hook to stake EON tokens
 */
export function useStake() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stake = (amount: string) => {
    writeContract({
      address: SAFETY_MODULE_ADDRESS,
      abi: SAFETY_MODULE_ABI,
      functionName: 'stake',
      args: [parseEther(amount)],
    });
  };

  return {
    stake,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to activate cooldown
 */
export function useActivateCooldown() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const activateCooldown = () => {
    writeContract({
      address: SAFETY_MODULE_ADDRESS,
      abi: SAFETY_MODULE_ABI,
      functionName: 'activateCooldown',
    });
  };

  return {
    activateCooldown,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to unstake tokens
 */
export function useUnstake() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unstake = (amount: string) => {
    writeContract({
      address: SAFETY_MODULE_ADDRESS,
      abi: SAFETY_MODULE_ABI,
      functionName: 'unstake',
      args: [parseEther(amount)],
    });
  };

  return {
    unstake,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to claim staking rewards
 */
export function useClaimRewards() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimRewards = () => {
    writeContract({
      address: SAFETY_MODULE_ADDRESS,
      abi: SAFETY_MODULE_ABI,
      functionName: 'claimRewards',
    });
  };

  return {
    claimRewards,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}
