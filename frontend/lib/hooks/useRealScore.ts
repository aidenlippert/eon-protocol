import { useReadContract } from 'wagmi';

const SCORE_ORACLE = process.env.NEXT_PUBLIC_SCORE_ORACLE_PHASE3B as `0x${string}`;

const ORACLE_ABI = [
  {
    inputs: [{ name: 'subject', type: 'address' }],
    name: 'computeScore',
    outputs: [
      {
        components: [
          { name: 'overall', type: 'uint16' },
          { name: 's1_repayment', type: 'uint8' },
          { name: 's2_collateral', type: 'uint8' },
          { name: 's3_sybil', type: 'uint8' },
          { name: 's4_crossChain', type: 'uint8' },
          { name: 's5_governance', type: 'uint8' },
          { name: 's3_raw', type: 'int16' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'overall', type: 'uint16' }],
    name: 'getScoreTier',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'overall', type: 'uint16' }],
    name: 'getAPR',
    outputs: [{ name: 'aprBps', type: 'uint16' }],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];

/**
 * Hook to get REAL credit score from ScoreOraclePhase3B contract
 */
export function useRealCreditScore(address?: string) {
  const { data: scoreData, isLoading } = useReadContract({
    address: SCORE_ORACLE,
    abi: ORACLE_ABI,
    functionName: 'computeScore',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    },
  });

  if (!scoreData || isLoading) {
    return {
      isLoading,
      score: 0,
      tier: 'Bronze',
      breakdown: {
        s1_repayment: 0,
        s2_collateral: 0,
        s3_sybil: 0,
        s4_crossChain: 0,
        s5_governance: 0,
        s3_raw: 0,
      },
      apr: 15,
      hasScore: false,
    };
  }

  const [overall, s1, s2, s3, s4, s5, s3Raw] = scoreData;
  const tierIndex = overall >= 90 ? 3 : overall >= 75 ? 2 : overall >= 60 ? 1 : 0;

  // Calculate APR from basis points (400 bps = 4%)
  const aprBps = overall >= 90 ? 400 : overall >= 75 ? 600 : overall >= 60 ? 800 : overall >= 45 ? 1000 : overall >= 30 ? 1200 : 1500;

  return {
    isLoading: false,
    score: Number(overall),
    tier: TIER_NAMES[tierIndex],
    breakdown: {
      s1_repayment: Number(s1),
      s2_collateral: Number(s2),
      s3_sybil: Number(s3),
      s4_crossChain: Number(s4),
      s5_governance: Number(s5),
      s3_raw: Number(s3Raw),
    },
    apr: aprBps / 100, // Convert basis points to percentage
    hasScore: true,
  };
}
