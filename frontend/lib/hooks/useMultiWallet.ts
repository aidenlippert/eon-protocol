import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';

const USER_REGISTRY = process.env.NEXT_PUBLIC_USER_REGISTRY as `0x${string}`;

const USER_REGISTRY_ABI = [
  {
    inputs: [{ name: 'kycHash', type: 'bytes32' }],
    name: 'registerUser',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'linkWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'unlinkWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMyWallets',
    outputs: [
      { name: 'primary', type: 'address' },
      { name: 'linked', type: 'address[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'isWalletRegistered',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'walletToKycHash',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_LINKED_WALLETS',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook to check if user is registered
 */
export function useIsRegistered(address?: string) {
  const { data: isRegistered, isLoading } = useReadContract({
    address: USER_REGISTRY,
    abi: USER_REGISTRY_ABI,
    functionName: 'isWalletRegistered',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  return {
    isRegistered: isRegistered || false,
    isLoading,
  };
}

/**
 * Hook to get user's linked wallets
 */
export function useLinkedWallets(address?: string) {
  const { data: walletsData, isLoading } = useReadContract({
    address: USER_REGISTRY,
    abi: USER_REGISTRY_ABI,
    functionName: 'getMyWallets',
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  if (!walletsData || isLoading) {
    return {
      primaryWallet: undefined,
      linkedWallets: [],
      totalWallets: 0,
      isLoading,
      hasLinkedWallets: false,
    };
  }

  const [primary, linked] = walletsData;

  return {
    primaryWallet: primary,
    linkedWallets: linked,
    totalWallets: 1 + linked.length,
    isLoading: false,
    hasLinkedWallets: linked.length > 0,
  };
}

/**
 * Hook to register user with KYC
 */
export function useRegisterUser() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const registerUser = async (kycHash: string) => {
    writeContract({
      address: USER_REGISTRY,
      abi: USER_REGISTRY_ABI,
      functionName: 'registerUser',
      args: [kycHash as `0x${string}`],
    });
  };

  return {
    registerUser,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to link additional wallet
 */
export function useLinkWallet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const linkWallet = async (walletAddress: string) => {
    writeContract({
      address: USER_REGISTRY,
      abi: USER_REGISTRY_ABI,
      functionName: 'linkWallet',
      args: [walletAddress as `0x${string}`],
    });
  };

  return {
    linkWallet,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to unlink wallet
 */
export function useUnlinkWallet() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const unlinkWallet = async (walletAddress: string) => {
    writeContract({
      address: USER_REGISTRY,
      abi: USER_REGISTRY_ABI,
      functionName: 'unlinkWallet',
      args: [walletAddress as `0x${string}`],
    });
  };

  return {
    unlinkWallet,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to get max linked wallets limit
 */
export function useMaxLinkedWallets() {
  const { data: maxWallets } = useReadContract({
    address: USER_REGISTRY,
    abi: USER_REGISTRY_ABI,
    functionName: 'MAX_LINKED_WALLETS',
  });

  return Number(maxWallets || 5);
}
