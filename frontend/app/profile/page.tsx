'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Award, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import { useCreditScore } from '../../lib/hooks/useCreditScore';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { creditScore, tierLabel, riskLevel, isLoading } = useCreditScore();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Credit Profile</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to view your on-chain credit score
          </p>
          <div className="text-violet-400">Please connect your wallet to continue</div>
        </div>
      </div>
    );
  }

  const score = creditScore?.score || 300;
  const ltv = creditScore?.ltv || 50;
  const interestMultiplier = creditScore?.interestRateMultiplier || 150;
  const baseRate = 8;
  const yourRate = (baseRate * interestMultiplier) / 100;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum': return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
      case 'Gold': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'Silver': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      case 'Bronze': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-violet-400';
    if (score >= 650) return 'text-green-400';
    if (score >= 500) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Credit Profile</h1>
        <p className="text-neutral-400 mb-8">
          On-chain credit scoring powered by smart contracts
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Credit Score</h2>
                <p className="text-neutral-400 text-sm">
                  Score range: 300-850 (FICO-style)
                </p>
              </div>
              {tierLabel && (
                <Badge className={getTierColor(tierLabel)}>
                  {tierLabel}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div className="flex items-baseline gap-4 mb-4">
                    <div className={`text-6xl font-bold ${getScoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="text-neutral-400">/ 850</div>
                  </div>
                  <Progress
                    value={((score - 300) / 550) * 100}
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-neutral-500 mt-2">
                    <span>300</span>
                    <span>500</span>
                    <span>670</span>
                    <span>850</span>
                  </div>
                </div>

                {score === 300 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-100">
                        <div className="font-medium mb-1">No Credit History</div>
                        <div className="text-yellow-200/80">
                          Your wallet has no credit history on our platform. Start by depositing collateral and taking a small loan to build your score.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Score Breakdown</h3>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Tier Level</span>
                      <Badge className={getTierColor(tierLabel || 'No Score')}>
                        {tierLabel || 'No Score'}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Max LTV</span>
                      <span className="text-lg font-bold text-violet-400">{ltv}%</span>
                    </div>
                    <p className="text-xs text-neutral-400">Maximum loan-to-value ratio for borrowing</p>
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Interest Rate Multiplier</span>
                      <span className="text-lg font-bold">{interestMultiplier}%</span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Your rate: {yourRate.toFixed(1)}% (Base: {baseRate}%)
                    </p>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Benefits Card */}
          <div className="space-y-6">
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold">Your Benefits</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-neutral-400 mb-1">Max LTV</div>
                  <div className="text-2xl font-bold text-violet-400">{ltv}%</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-400 mb-1">Interest Rate</div>
                  <div className="text-2xl font-bold">{yourRate.toFixed(1)}%</div>
                  {interestMultiplier < 100 && (
                    <div className="text-xs text-green-400 mt-1">
                      {100 - interestMultiplier}% discount!
                    </div>
                  )}
                  {interestMultiplier > 100 && (
                    <div className="text-xs text-red-400 mt-1">
                      {interestMultiplier - 100}% premium
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">How to Improve</h3>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Borrow and repay loans on time</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Keep your health factor above 1.5</span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Build a history of successful transactions</span>
                </li>
              </ul>
            </Card>

            <Card className="bg-violet-500/10 border-violet-500/20 p-6">
              <h3 className="text-lg font-semibold mb-2 text-violet-400">Tier System</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-violet-300">Platinum:</span>
                  <span className="text-neutral-400">800-850 (90% LTV)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-300">Gold:</span>
                  <span className="text-neutral-400">650-799 (80% LTV)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Silver:</span>
                  <span className="text-neutral-400">500-649 (70% LTV)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-300">Bronze:</span>
                  <span className="text-neutral-400">300-499 (50% LTV)</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
