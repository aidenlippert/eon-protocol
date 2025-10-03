'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { calculateOnChainScore, getCreditTier, getLTV, type ScoreBreakdown } from '@/lib/score-calculator';
import { Loader2, Award, TrendingUp } from 'lucide-react';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreBreakdown | null>(null);

  const handleCalculateScore = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const data = await calculateOnChainScore(address);
      setScoreData(data);
    } catch (error) {
      console.error('Failed to calculate score:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Credit Profile</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to calculate your on-chain credit score
          </p>
          <div className="text-violet-400">Please connect your wallet to continue</div>
        </div>
      </div>
    );
  }

  const tier = scoreData ? getCreditTier(scoreData.totalScore) : 'Bronze';
  const ltv = getLTV(tier);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Your Credit Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Credit Score</h2>
                <p className="text-neutral-400">Based on your on-chain activity</p>
              </div>
              <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                {tier}
              </Badge>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-4 mb-4">
                <div className="text-6xl font-bold text-violet-400">
                  {scoreData?.totalScore ?? '---'}
                </div>
                <div className="text-neutral-400">/ 1000</div>
              </div>
              <Progress value={scoreData ? (scoreData.totalScore / 1000) * 100 : 0} className="h-2" />
            </div>

            <Button
              onClick={handleCalculateScore}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing On-Chain History...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Calculate Score
                </>
              )}
            </Button>

            {scoreData && (
              <div className="mt-8 p-6 bg-neutral-950/50 rounded-lg border border-neutral-800">
                <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Wallet Age', value: scoreData.walletAge, max: 150 },
                    { label: 'Transaction Volume', value: scoreData.txVolume, max: 200 },
                    { label: 'DeFi Interactions', value: scoreData.defiInteractions, max: 250 },
                    { label: 'Liquidation History', value: scoreData.liquidationHistory, max: 200 },
                    { label: 'Repayment History', value: scoreData.repaymentHistory, max: 150 },
                    { label: 'Wallet Balance', value: scoreData.balance, max: 50 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">{item.label}</span>
                        <span className="text-sm font-medium">
                          {item.value} / {item.max}
                        </span>
                      </div>
                      <Progress value={(item.value / item.max) * 100} className="h-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Benefits Card */}
          <div className="space-y-6">
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold">Current Tier</h3>
              </div>
              <div className="text-3xl font-bold text-violet-400 mb-2">{tier}</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Max LTV</span>
                  <span className="font-medium">{ltv}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Grace Period</span>
                  <span className="font-medium">
                    {tier === 'Platinum' ? '72h' : tier === 'Gold' ? '60h' : tier === 'Silver' ? '48h' : '24h'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Interest Rate</span>
                  <span className="font-medium">
                    {tier === 'Platinum' ? '3%' : tier === 'Gold' ? '5%' : tier === 'Silver' ? '7%' : '10%'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">How to Improve</h3>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Increase transaction volume on Arbitrum</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Interact with DeFi protocols (lending, swaps)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Maintain healthy wallet balance</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Avoid liquidations and defaults</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
