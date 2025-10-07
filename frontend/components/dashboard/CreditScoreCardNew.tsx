"use client";

import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";
import { useRealCreditScore } from "@/lib/hooks/useRealScore";

const getTierColor = (tier: string) => {
  const colors = {
    Bronze: "bg-orange-500/20 text-orange-400 border-orange-500/50",
    Silver: "bg-gray-500/20 text-gray-300 border-gray-400/50",
    Gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    Platinum: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  };
  return colors[tier as keyof typeof colors] || colors.Bronze;
};

const getLTVByTier = (tier: string) => {
  const ltv = {
    Bronze: "50%",
    Silver: "70%",
    Gold: "80%",
    Platinum: "90%",
  };
  return ltv[tier as keyof typeof ltv] || "50%";
};

export function CreditScoreCardNew() {
  const { address } = useAccount();

  // REAL DATA: Credit score from ScoreOraclePhase3B contract
  const { score, tier, breakdown, apr, isLoading, hasScore } = useRealCreditScore(address);

  if (!address) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle>Your Credit Score</CardTitle>
          <CardDescription>Connect wallet to see your score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-neutral-400">
            Connect your wallet to view your credit profile
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            <span className="text-neutral-400">Loading credit score from blockchain...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasScore) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-red-400">Failed to load score from ScoreOracle</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Credit Score</CardTitle>
            <CardDescription>Complete 5-factor on-chain credit assessment (Phase 3B)</CardDescription>
          </div>
          <Badge className={getTierColor(tier)}>{tier}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Score Display */}
        <div className="text-center mb-8">
          <div className="text-7xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-2">
            {score}
          </div>
          <div className="text-sm text-neutral-400">out of 100 (from blockchain)</div>
        </div>

        {/* APR & LTV */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/60 mb-1">APR Rate</div>
            <div className="text-2xl font-bold text-white">{apr}%</div>
            <div className="text-xs text-white/50 mt-1">from ScoreOracle</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/60 mb-1">Max LTV</div>
            <div className="text-2xl font-bold text-white">{getLTVByTier(tier)}</div>
            <div className="text-xs text-white/50 mt-1">based on tier</div>
          </div>
        </div>

        {/* Score Breakdown - REAL from ScoreOraclePhase3B */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white/80 mb-2">Score Breakdown (Phase 3B)</div>

          <ScoreFactor
            label="S1: Repayment History"
            score={breakdown.s1_repayment}
            weight="40%"
            description="Loan repayment track record"
          />
          <ScoreFactor
            label="S2: Collateral Utilization"
            score={breakdown.s2_collateral}
            weight="20%"
            description="Collateral management efficiency"
          />
          <ScoreFactor
            label="S3: Sybil Resistance"
            score={breakdown.s3_sybil}
            weight="20%"
            description={`KYC + wallet age + staking (raw: ${breakdown.s3_raw})`}
          />
          <ScoreFactor
            label="S4: Cross-Chain Reputation"
            score={breakdown.s4_crossChain}
            weight="10%"
            description="Multi-chain activity score"
          />
          <ScoreFactor
            label="S5: Governance Participation"
            score={breakdown.s5_governance}
            weight="10%"
            description="DAO voting and proposals"
          />
        </div>

        {/* Improvement Tip */}
        <div className="mt-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-400">
              <div className="font-semibold mb-1">Quick Tip</div>
              <div className="text-violet-400/80">
                Complete KYC verification to boost your Sybil Resistance score (S3) by +150 points
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreFactor({
  label,
  score,
  weight,
  description,
}: {
  label: string;
  score: number;
  weight: string;
  description?: string;
}) {
  const percentage = Math.min(score, 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-white/70">{label}</span>
        <span className="text-xs text-white/50">{weight} weight</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1">
        <div className="text-xs text-white/50">{score}/100</div>
        {description && <div className="text-xs text-white/40">{description}</div>}
      </div>
    </div>
  );
}
