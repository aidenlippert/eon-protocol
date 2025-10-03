import { useReadContract, useAccount } from 'wagmi';
import { getContractAddress } from '../contracts/addresses';
import CreditRegistryABI from '../contracts/CreditRegistryV1_1.json';

export interface CreditScore {
  score: number;
  tier: number;
  ltv: number;
  interestRateMultiplier: number;
  lastUpdated: bigint;
  dataQuality: number;
}

export function useCreditScore() {
  const { address } = useAccount();

  const { data, isLoading, error, refetch } = useReadContract({
    address: getContractAddress(421614, 'CreditRegistryV1_1') as `0x${string}`,
    abi: CreditRegistryABI,
    functionName: 'getScore',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const creditScore: CreditScore | null = data ? {
    score: Number((data as any)[0]),
    tier: Number((data as any)[1]),
    ltv: Number((data as any)[2]),
    interestRateMultiplier: Number((data as any)[3]),
    lastUpdated: (data as any)[4] as bigint,
    dataQuality: Number((data as any)[5]),
  } : null;

  const tierLabel = creditScore ? getTierLabel(creditScore.tier) : null;
  const riskLevel = creditScore ? getRiskLevel(creditScore.score) : null;

  return {
    creditScore,
    tierLabel,
    riskLevel,
    isLoading,
    error,
    refetch,
  };
}

function getTierLabel(tier: number): string {
  const labels = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Subprime'];
  return labels[tier] || 'Unknown';
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 740) return 'low';
  if (score >= 670) return 'medium';
  return 'high';
}
