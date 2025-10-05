"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp } from "lucide-react";

interface ScoreData {
  score: number;
  tier: string;
  factors: {
    s1_paymentHistory: number;
    s2_utilization: number;
    s3_accountAge: number;
    s4_identityTrust: number;
    s5_assetDiversity: number;
    s6_deFiMix: number;
    s7_activityControl: number;
  };
}

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
    Silver: "60%",
    Gold: "70%",
    Platinum: "80%",
  };
  return ltv[tier as keyof typeof ltv] || "50%";
};

const getAPRByTier = (tier: string) => {
  const apr = {
    Bronze: "12%",
    Silver: "10%",
    Gold: "7%",
    Platinum: "5%",
  };
  return apr[tier as keyof typeof apr] || "12%";
};

export function CreditScoreCardNew() {
  const { address } = useAccount();
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setScoreData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/score/${address}`)
      .then((res) => res.json())
      .then((data) => {
        setScoreData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[CreditScoreCard] Error:", err);
        setLoading(false);
      });
  }, [address]);

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

  if (loading) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            <span className="text-neutral-400">Loading credit score...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scoreData) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-red-400">Failed to load score</div>
        </CardContent>
      </Card>
    );
  }

  const { score, tier, factors } = scoreData;
  const scorePercentage = (score / 1000) * 100;

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Credit Score</CardTitle>
            <CardDescription>Complete 7-factor on-chain credit assessment</CardDescription>
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
          <div className="text-sm text-neutral-400">out of 1000</div>
        </div>

        {/* APR & LTV */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/60 mb-1">APR Rate</div>
            <div className="text-2xl font-bold text-white">{getAPRByTier(tier)}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/60 mb-1">Max LTV</div>
            <div className="text-2xl font-bold text-white">{getLTVByTier(tier)}</div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white/80 mb-2">Score Breakdown</div>

          <ScoreFactor
            label="Payment History"
            score={factors.s1_paymentHistory}
            weight="30%"
          />
          <ScoreFactor
            label="Credit Utilization"
            score={factors.s2_utilization}
            weight="20%"
          />
          <ScoreFactor
            label="Account Age"
            score={factors.s3_accountAge}
            weight="10%"
          />
          <ScoreFactor
            label="Identity Trust"
            score={factors.s4_identityTrust}
            weight="15%"
          />
          <ScoreFactor
            label="Asset Diversity"
            score={factors.s5_assetDiversity}
            weight="10%"
          />
          <ScoreFactor
            label="DeFi Mix"
            score={factors.s6_deFiMix}
            weight="10%"
          />
          <ScoreFactor
            label="Activity Control"
            score={factors.s7_activityControl}
            weight="5%"
          />
        </div>

        {/* Improvement Tip */}
        <div className="mt-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-400">
              <div className="font-semibold mb-1">Quick Tip</div>
              <div className="text-violet-400/80">
                Complete KYC verification to boost your score by +150 points instantly
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
}: {
  label: string;
  score: number;
  weight: string;
}) {
  const percentage = Math.min((score / 100) * 100, 100);

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
      <div className="text-xs text-white/50 mt-1">{score.toFixed(0)}/100</div>
    </div>
  );
}
