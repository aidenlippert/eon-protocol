import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/addresses";

// CreditRegistryV3 ABI (minimal for KYC functions)
const REGISTRY_ABI = [
  {
    inputs: [
      { name: "credentialHash", type: "bytes32" },
      { name: "expiresAt", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    name: "submitKYCProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getKYCProof",
    outputs: [
      {
        components: [
          { name: "credentialHash", type: "bytes32" },
          { name: "verifiedAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isKYCVerified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface KYCProof {
  credentialHash: string;
  verifiedAt: bigint;
  expiresAt: bigint;
}

export function useKYCStatus(userAddress?: `0x${string}`) {
  const { address } = useAccount();
  const targetAddress = userAddress || address;

  // Read KYC proof from contract
  const { data: kycProof, isLoading: isLoadingProof, refetch: refetchProof } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getKYCProof",
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress,
    },
  });

  // Read verified status
  const { data: isVerified, isLoading: isLoadingVerified } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "isKYCVerified",
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress,
    },
  });

  return {
    kycProof: kycProof as KYCProof | undefined,
    isVerified: isVerified as boolean | undefined,
    isLoading: isLoadingProof || isLoadingVerified,
    refetch: refetchProof,
  };
}

export function useSubmitKYCProof() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const submitProof = async (
    credentialId: string,
    expiresAt: number,
    issuerSignature: string
  ) => {
    const { address } = useAccount();
    if (!address) throw new Error("Wallet not connected");

    // Create credential hash
    const credentialHash = keccak256(
      encodePacked(
        ["string", "address", "uint256"],
        [credentialId, address, BigInt(expiresAt)]
      )
    );

    // Submit to contract
    const txHash = await writeContractAsync({
      address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "submitKYCProof",
      args: [credentialHash, BigInt(expiresAt), issuerSignature as `0x${string}`],
    });

    return txHash;
  };

  return {
    submitProof,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

// Helper to format KYC proof for display
export function formatKYCProof(proof?: KYCProof) {
  if (!proof || proof.verifiedAt === BigInt(0)) {
    return {
      verified: false,
      verifiedAt: null,
      expiresAt: null,
      credentialHash: null,
    };
  }

  return {
    verified: true,
    verifiedAt: new Date(Number(proof.verifiedAt) * 1000),
    expiresAt: new Date(Number(proof.expiresAt) * 1000),
    credentialHash: proof.credentialHash,
    isExpired: Date.now() / 1000 > Number(proof.expiresAt),
  };
}
