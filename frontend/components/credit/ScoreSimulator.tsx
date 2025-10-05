'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Calculator, TrendingUp, Award, DollarSign, Shield } from 'lucide-react';

interface ScoreData {
  score: number;
  tier: string;
  apr: number;
  maxLTV: number;
}

interface Simulation {
  action: string;
  icon: React.ReactNode;
  scoreDelta: number;
  currentScore: number;
  projectedScore: number;
  currentTier: string;
  projectedTier: string;
  currentAPR: number;
  projectedAPR: number;
  currentLTV: number;
  projectedLTV: number;
  savings?: number;
  description: string;
}

export function ScoreSimulator() {
  const { address } = useAccount();
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('repay');
  const [customAmount, setCustomAmount] = useState<number>(500);

  // Fetch current score
  useEffect(() => {
    if (!address) return;

    fetch(`/api/score/${address}`)
      .then((res) => res.json())
      .then((data) => setScoreData(data))
      .catch((err) => console.error('[ScoreSimulator] Error:', err));
  }, [address]);

  if (!address || !scoreData) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-neutral-400">
            {!address ? 'Connect wallet to use simulator' : 'Loading...'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Tier thresholds
  const getTierFromScore = (score: number): string => {
    if (score >= 900) return 'Platinum';
    if (score >= 750) return 'Gold';
    if (score >= 600) return 'Silver';
    return 'Bronze';
  };

  const getAPRFromScore = (score: number): number => {
    if (score >= 900) return 5.0;
    if (score >= 750) return 7.0;
    if (score >= 600) return 10.0;
    return 12.0;
  };

  const getLTVFromScore = (score: number): number => {
    if (score >= 900) return 80;
    if (score >= 750) return 70;
    if (score >= 600) return 60;
    return 50;
  };

  // Simulation scenarios
  const simulations: Simulation[] = [
    {
      action: 'repay',
      icon: <DollarSign className="w-5 h-5" />,
      scoreDelta: 25,
      currentScore: scoreData.score,
      projectedScore: Math.min(scoreData.score + 25, 1000),
      currentTier: scoreData.tier,
      projectedTier: getTierFromScore(Math.min(scoreData.score + 25, 1000)),
      currentAPR: scoreData.apr,
      projectedAPR: getAPRFromScore(Math.min(scoreData.score + 25, 1000)),
      currentLTV: scoreData.maxLTV,
      projectedLTV: getLTVFromScore(Math.min(scoreData.score + 25, 1000)),
      description: 'Repaying an active loan boosts your payment history (S1)',
    },
    {
      action: 'kyc',
      icon: <Shield className="w-5 h-5" />,
      scoreDelta: 150,
      currentScore: scoreData.score,
      projectedScore: Math.min(scoreData.score + 150, 1000),
      currentTier: scoreData.tier,
      projectedTier: getTierFromScore(Math.min(scoreData.score + 150, 1000)),
      currentAPR: scoreData.apr,
      projectedAPR: getAPRFromScore(Math.min(scoreData.score + 150, 1000)),
      currentLTV: scoreData.maxLTV,
      projectedLTV: getLTVFromScore(Math.min(scoreData.score + 150, 1000)),
      description: 'Verify your identity with Didit KYC for massive boost (S4)',
    },
    {
      action: 'wait6months',
      icon: <TrendingUp className="w-5 h-5" />,
      scoreDelta: 25,
      currentScore: scoreData.score,
      projectedScore: Math.min(scoreData.score + 25, 1000),
      currentTier: scoreData.tier,
      projectedTier: getTierFromScore(Math.min(scoreData.score + 25, 1000)),
      currentAPR: scoreData.apr,
      projectedAPR: getAPRFromScore(Math.min(scoreData.score + 25, 1000)),
      currentLTV: scoreData.maxLTV,
      projectedLTV: getLTVFromScore(Math.min(scoreData.score + 25, 1000)),
      description: 'Account age increases naturally over time (S3)',
    },
    {
      action: 'addCollateral',
      icon: <Award className="w-5 h-5" />,
      scoreDelta: 15,
      currentScore: scoreData.score,
      projectedScore: Math.min(scoreData.score + 15, 1000),
      currentTier: scoreData.tier,
      projectedTier: getTierFromScore(Math.min(scoreData.score + 15, 1000)),
      currentAPR: scoreData.apr,
      projectedAPR: getAPRFromScore(Math.min(scoreData.score + 15, 1000)),
      currentLTV: scoreData.maxLTV,
      projectedLTV: getLTVFromScore(Math.min(scoreData.score + 15, 1000)),
      description: `Adding $${customAmount} collateral reduces utilization (S2)`,
    },
  ];

  const currentSimulation = simulations.find((s) => s.action === selectedAction) || simulations[0];

  // Calculate savings
  const calculateSavings = (currentAPR: number, projectedAPR: number, loanAmount: number = 1000) => {
    const currentInterest = (loanAmount * currentAPR) / 100;
    const projectedInterest = (loanAmount * projectedAPR) / 100;
    return currentInterest - projectedInterest;
  };

  const savings = calculateSavings(currentSimulation.currentAPR, currentSimulation.projectedAPR);

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-6 h-6 text-violet-400" />
          Credit Score Simulator
        </CardTitle>
        <CardDescription>See how actions affect your credit score and loan terms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Selector */}
        <div>
          <div className="text-sm font-semibold text-white/80 mb-3">Select Action:</div>
          <div className="grid grid-cols-2 gap-3">
            {simulations.map((sim) => (
              <Button
                key={sim.action}
                variant={selectedAction === sim.action ? 'default' : 'outline'}
                className={`justify-start gap-2 ${
                  selectedAction === sim.action
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => setSelectedAction(sim.action)}
              >
                {sim.icon}
                <span className="capitalize">
                  {sim.action === 'wait6months' ? 'Wait 6 Months' : sim.action.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Collateral Amount Slider (only for addCollateral) */}
        {selectedAction === 'addCollateral' && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-sm font-semibold text-white/80 mb-3">
              Collateral Amount: ${customAmount}
            </div>
            <Slider
              value={[customAmount]}
              onValueChange={(value) => setCustomAmount(value[0])}
              min={100}
              max={5000}
              step={100}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-white/50">
              <span>$100</span>
              <span>$5,000</span>
            </div>
          </div>
        )}

        {/* Score Impact Visualization */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-white/60 mb-1">Current Score</div>
              <div className="text-3xl font-bold text-white">{currentSimulation.currentScore}</div>
              <div className="text-sm text-white/50">{currentSimulation.currentTier}</div>
            </div>

            <div className="flex items-center gap-3 px-4">
              <div className="text-2xl text-violet-400">→</div>
              <div
                className={`px-3 py-1 rounded-lg font-bold ${
                  currentSimulation.scoreDelta > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {currentSimulation.scoreDelta > 0 ? '+' : ''}
                {currentSimulation.scoreDelta}
              </div>
            </div>

            <div>
              <div className="text-sm text-white/60 mb-1">Projected Score</div>
              <div className="text-3xl font-bold text-violet-400">{currentSimulation.projectedScore}</div>
              <div className="text-sm text-violet-400/80">{currentSimulation.projectedTier}</div>
            </div>
          </div>

          <div className="text-sm text-white/70 text-center">{currentSimulation.description}</div>
        </div>

        {/* Loan Terms Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/60 mb-2">Interest Rate (APR)</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-white">{currentSimulation.currentAPR}%</div>
              <div className="text-sm text-white/50">→</div>
              <div className="text-2xl font-bold text-violet-400">{currentSimulation.projectedAPR}%</div>
            </div>
            {savings > 0 && (
              <div className="text-xs text-green-400 mt-1">Save ${savings.toFixed(2)}/year on $1K loan</div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/60 mb-2">Max LTV</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-white">{currentSimulation.currentLTV}%</div>
              <div className="text-sm text-white/50">→</div>
              <div className="text-2xl font-bold text-violet-400">{currentSimulation.projectedLTV}%</div>
            </div>
            {currentSimulation.projectedLTV > currentSimulation.currentLTV && (
              <div className="text-xs text-green-400 mt-1">
                Borrow {currentSimulation.projectedLTV - currentSimulation.currentLTV}% more!
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="text-sm font-semibold text-violet-400 mb-2">💡 Next Steps</div>
          <div className="text-sm text-white/80">
            {selectedAction === 'repay' && 'Repay your active loan to boost your payment history score.'}
            {selectedAction === 'kyc' && 'Complete KYC verification in the Dashboard for a +150 point boost!'}
            {selectedAction === 'wait6months' &&
              'Account age improves naturally. Keep using EON to build credit over time.'}
            {selectedAction === 'addCollateral' &&
              `Add $${customAmount} in collateral to reduce your credit utilization ratio.`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
