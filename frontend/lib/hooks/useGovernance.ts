import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

// Contract addresses (update from deployment)
const EON_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_EON_TOKEN as `0x${string}`;
const GOVERNOR_ADDRESS = process.env.NEXT_PUBLIC_GOVERNOR as `0x${string}`;

const EON_TOKEN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'delegatee', type: 'address' }],
    name: 'delegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const GOVERNOR_ABI = [
  {
    inputs: [],
    name: 'proposalThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'blockNumber', type: 'uint256' }],
    name: 'quorum',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'votingDelay',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'votingPeriod',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to get user's voting power
 */
export function useVotingPower(address?: string) {
  return useReadContract({
    address: EON_TOKEN_ADDRESS,
    abi: EON_TOKEN_ABI,
    functionName: 'getVotes',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to delegate voting power
 */
export function useDelegate() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const delegate = (delegatee: string) => {
    writeContract({
      address: EON_TOKEN_ADDRESS,
      abi: EON_TOKEN_ABI,
      functionName: 'delegate',
      args: [delegatee as `0x${string}`],
    });
  };

  return {
    delegate,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}

/**
 * Hook to get governance parameters
 */
export function useGovernanceParams() {
  const { data: proposalThreshold } = useReadContract({
    address: GOVERNOR_ADDRESS,
    abi: GOVERNOR_ABI,
    functionName: 'proposalThreshold',
  });

  const { data: votingDelay } = useReadContract({
    address: GOVERNOR_ADDRESS,
    abi: GOVERNOR_ABI,
    functionName: 'votingDelay',
  });

  const { data: votingPeriod } = useReadContract({
    address: GOVERNOR_ADDRESS,
    abi: GOVERNOR_ABI,
    functionName: 'votingPeriod',
  });

  return {
    proposalThreshold,
    votingDelay,
    votingPeriod,
  };
}

/**
 * Hook to get EON total supply
 */
export function useEONTotalSupply() {
  return useReadContract({
    address: EON_TOKEN_ADDRESS,
    abi: EON_TOKEN_ABI,
    functionName: 'totalSupply',
  });
}
