"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Award,
  Shield,
  Globe,
  Users,
  PiggyBank,
  CheckCircle2,
  XCircle,
  Info
} from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/addresses";

const ORACLE_ABI = [
  {
    inputs: [{ name: "subject", type: "address" }],
    name: "computeScore",
    outputs: [
      {
        components: [
          { name: "overall", type: "uint16" },
          { name: "s1_repayment", type: "uint8" },
          { name: "s2_collateral", type: "uint8" },
          { name: "s3_sybil", type: "uint8" },
          { name: "s4_crossChain", type: "uint8" },
          { name: "s5_governance", type: "uint8" },
          { name: "s3_raw", type: "int16" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "overall", type: "uint16" }],
    name: "getScoreTier",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [{ name: "overall", type: "uint16" }],
    name: "getAPR",
    outputs: [{ name: "aprBps", type: "uint16" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

interface ScoreBreakdown {
  overall: number;
  s1_repayment: number;
  s2_collateral: number;
  s3_sybil: number;
  s4_crossChain: number;
  s5_governance: number;
  s3_raw: number;
}

const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"] as const;
const TIER_COLORS = {
  0: "text-amber-700 bg-amber-50 border-amber-200",
  1: "text-gray-700 bg-gray-50 border-gray-200",
  2: "text-yellow-700 bg-yellow-50 border-yellow-200",
  3: "text-purple-700 bg-purple-50 border-purple-200",
} as const;

const LTV_BY_TIER = [50, 70, 80, 90];

export function CreditScoreCard() {
  const { address, isConnected } = useAccount();
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Read score from contract
  const { data: scoreData, isLoading: isLoadingScore, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].ScoreOraclePhase3B as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "computeScore",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // Read tier
  const { data: tier } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].ScoreOraclePhase3B as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "getScoreTier",
    args: scoreData ? [scoreData.overall] : undefined,
    query: {
      enabled: !!scoreData,
    },
  });

  // Read APR
  const { data: aprBps } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].ScoreOraclePhase3B as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "getAPR",
    args: scoreData ? [scoreData.overall] : undefined,
    query: {
      enabled: !!scoreData,
    },
  });

  const score = scoreData as ScoreBreakdown | undefined;
  const tierIndex = Number(tier || 0);
  const apr = aprBps ? Number(aprBps) / 100 : 0;

  // Track score history for trend
  useEffect(() => {
    if (score?.overall) {
      setScoreHistory(prev => {
        const newHistory = [...prev, score.overall];
        return newHistory.slice(-10); // Keep last 10 scores
      });
    }
  }, [score?.overall]);

  const scoreTrend = scoreHistory.length > 1
    ? scoreHistory[scoreHistory.length - 1] - scoreHistory[0]
    : 0;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Score</CardTitle>
          <CardDescription>Connect your wallet to view your credit score</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoadingScore) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Score</CardTitle>
          <CardDescription>Loading your credit score...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Score</CardTitle>
          <CardDescription>No score data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Your Credit Score</CardTitle>
            <CardDescription className="text-base mt-1">
              Complete 5-factor on-chain credit assessment
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`text-lg px-4 py-2 ${TIER_COLORS[tierIndex as keyof typeof TIER_COLORS]}`}
          >
            <Award className="h-4 w-4 mr-2" />
            {TIER_NAMES[tierIndex]}
          </Badge>
        </div>

        {/* Overall Score */}
        <div className="mt-6">
          <div className="flex items-baseline gap-4">
            <div className="text-6xl font-bold text-primary">
              {score.overall}
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">out of 100</span>
              {scoreTrend !== 0 && (
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  scoreTrend > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreTrend > 0 ? (
                    <><TrendingUp className="h-4 w-4" /> +{scoreTrend}</>
                  ) : (
                    <><TrendingDown className="h-4 w-4" /> {scoreTrend}</>
                  )}
                </div>
              )}
            </div>
          </div>

          <Progress value={score.overall} className="mt-4 h-3" />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">APR Rate</div>
            <div className="text-2xl font-bold">{apr}%</div>
          </div>
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Max LTV</div>
            <div className="text-2xl font-bold">{LTV_BY_TIER[tierIndex]}%</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Score Breakdown */}
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Score Breakdown
            </h3>

            {/* S1 - Repayment History */}
            <ScoreFactor
              icon={<CheckCircle2 className="h-5 w-5" />}
              name="Repayment History"
              score={score.s1_repayment}
              weight={40}
              description="Payment track record and liquidation history"
              color="blue"
            />

            {/* S2 - Collateral Utilization */}
            <ScoreFactor
              icon={<PiggyBank className="h-5 w-5" />}
              name="Collateral Utilization"
              score={score.s2_collateral}
              weight={20}
              description="Average collateralization ratio and diversity"
              color="green"
            />

            {/* S3 - Sybil Resistance */}
            <ScoreFactor
              icon={<Shield className="h-5 w-5" />}
              name="Sybil Resistance"
              score={score.s3_sybil}
              weight={20}
              description={`KYC verification, wallet age, and staking (Raw: ${score.s3_raw})`}
              color="purple"
              showRaw={true}
              rawScore={score.s3_raw}
            />

            {/* S4 - Cross-Chain Reputation */}
            <ScoreFactor
              icon={<Globe className="h-5 w-5" />}
              name="Cross-Chain Reputation"
              score={score.s4_crossChain}
              weight={10}
              description="Credit history across multiple blockchains"
              color="orange"
            />

            {/* S5 - Governance Participation */}
            <ScoreFactor
              icon={<Users className="h-5 w-5" />}
              name="Governance Participation"
              score={score.s5_governance}
              weight={10}
              description="Voting activity and proposal creation"
              color="pink"
            />
          </div>

          <Separator />

          {/* How to Improve */}
          <div>
            <h3 className="font-semibold mb-3">How to Improve Your Score</h3>
            <div className="space-y-2 text-sm">
              {score.s1_repayment < 80 && (
                <ImprovementTip
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  text="Repay loans on time to build payment history"
                  impact="+40% weight"
                />
              )}
              {score.s3_sybil < 50 && (
                <ImprovementTip
                  icon={<Shield className="h-4 w-4" />}
                  text="Complete KYC verification for instant +150 point boost"
                  impact="+20% weight"
                />
              )}
              {score.s2_collateral < 70 && (
                <ImprovementTip
                  icon={<PiggyBank className="h-4 w-4" />}
                  text="Use conservative collateral ratios and diverse assets"
                  impact="+20% weight"
                />
              )}
              {score.s4_crossChain === 0 && (
                <ImprovementTip
                  icon={<Globe className="h-4 w-4" />}
                  text="Build credit history on other chains (Optimism, Base)"
                  impact="+10% weight"
                />
              )}
              {score.s5_governance < 30 && (
                <ImprovementTip
                  icon={<Users className="h-4 w-4" />}
                  text="Participate in governance voting and proposals"
                  impact="+10% weight"
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScoreFactorProps {
  icon: React.ReactNode;
  name: string;
  score: number;
  weight: number;
  description: string;
  color: "blue" | "green" | "purple" | "orange" | "pink";
  showRaw?: boolean;
  rawScore?: number;
}

function ScoreFactor({ icon, name, score, weight, description, color, showRaw, rawScore }: ScoreFactorProps) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-950",
    green: "text-green-600 bg-green-50 dark:bg-green-950",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-950",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-950",
    pink: "text-pink-600 bg-pink-50 dark:bg-pink-950",
  };

  const progressColor = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
  };

  return (
    <div className="mb-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-xs text-muted-foreground">{weight}% weight</div>
        </div>
      </div>
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor[color]} transition-all duration-500`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      {showRaw && rawScore !== undefined && (
        <div className="mt-1 text-xs text-muted-foreground">
          Raw S3: {rawScore} (range: -450 to +295)
        </div>
      )}
    </div>
  );
}

function ImprovementTip({ icon, text, impact }: { icon: React.ReactNode; text: string; impact: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
      <div className="text-primary mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-sm">{text}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{impact}</div>
      </div>
    </div>
  );
}
