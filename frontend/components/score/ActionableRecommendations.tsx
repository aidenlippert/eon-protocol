'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Target,
  Shield,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Award,
} from 'lucide-react';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  impact: number; // Estimated score impact (points)
  title: string;
  description: string;
  action: string;
  category: 'payment' | 'utilization' | 'history' | 'mix' | 'kyc' | 'security';
  timeEstimate: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ActionableRecommendationsProps {
  currentScore: number;
  tier: string;
  breakdown: any;
  sybilData: any;
}

/**
 * @title Actionable Recommendations Component
 * @notice Personalized, prioritized actions to improve credit score
 * @dev Analyzes current state and generates specific, actionable guidance
 */
export function ActionableRecommendations({
  currentScore,
  tier,
  breakdown,
  sybilData,
}: ActionableRecommendationsProps) {
  const recommendations = generateRecommendations(currentScore, tier, breakdown, sybilData);

  // Sort by priority and impact
  const sortedRecommendations = recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.impact - a.impact;
  });

  const totalPotentialIncrease = recommendations.reduce((sum, rec) => sum + rec.impact, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold mb-1">Improve Your Score</h3>
          <p className="text-sm text-neutral-400">
            Personalized recommendations to reach the next tier
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-400">Potential Increase</div>
          <div className="text-3xl font-bold text-green-400">+{totalPotentialIncrease}</div>
          <div className="text-xs text-neutral-500">points</div>
        </div>
      </div>

      {/* Next Tier Goal */}
      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-violet-500/20 rounded-lg">
            <Target className="h-6 w-6 text-violet-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold mb-2">Next Tier: {getNextTier(tier)}</h4>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 bg-neutral-900/50 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${getProgressToNextTier(currentScore, tier)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-violet-400">
                {getNextTierThreshold(tier) - currentScore} points to go
              </span>
            </div>
            <p className="text-sm text-neutral-300">
              Complete {Math.min(3, recommendations.filter(r => r.priority === 'high').length)} high-priority actions below to unlock better terms and lower interest rates.
            </p>
          </div>
        </div>
      </Card>

      {/* Recommendations */}
      <div className="space-y-3">
        {sortedRecommendations.map((rec, index) => (
          <Card
            key={rec.id}
            className={`p-5 border ${
              rec.priority === 'high'
                ? 'border-red-500/20 bg-red-500/5'
                : rec.priority === 'medium'
                ? 'border-yellow-500/20 bg-yellow-500/5'
                : 'border-neutral-800 bg-neutral-900/50'
            } hover:border-violet-500/30 transition-all`}
          >
            <div className="flex items-start gap-4">
              {/* Priority Badge */}
              <div className="flex flex-col items-center gap-2">
                <Badge
                  className={
                    rec.priority === 'high'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : rec.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30'
                  }
                >
                  {rec.priority}
                </Badge>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">+{rec.impact}</div>
                  <div className="text-xs text-neutral-500">pts</div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-lg">{rec.title}</h4>
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(rec.category)}
                  </div>
                </div>

                <p className="text-sm text-neutral-400 mb-3">{rec.description}</p>

                <div className="flex items-center gap-4 mb-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {rec.timeEstimate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {rec.difficulty}
                  </span>
                </div>

                <Button
                  size="sm"
                  className="bg-violet-500 hover:bg-violet-600 text-white"
                >
                  {rec.action}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Success Message */}
      {recommendations.length === 0 && (
        <Card className="bg-green-500/10 border-green-500/20 p-8 text-center">
          <Award className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h4 className="font-semibold text-lg mb-2">Excellent Credit Profile!</h4>
          <p className="text-neutral-400 mb-4">
            You're in the top tier. Continue maintaining your strong credit behavior.
          </p>
          <Button variant="outline" className="border-green-500/30 text-green-400">
            View Advanced Strategies
          </Button>
        </Card>
      )}
    </div>
  );
}

// Helper functions

function generateRecommendations(
  score: number,
  tier: string,
  breakdown: any,
  sybilData: any
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Payment History recommendations
  if (breakdown.paymentHistory.score < 70) {
    const liquidations = breakdown.paymentHistory.evidence?.liquidations || 0;
    if (liquidations > 0) {
      recommendations.push({
        id: 'reduce-liquidations',
        priority: 'high',
        impact: 15,
        title: 'Avoid Future Liquidations',
        description: `You have ${liquidations} liquidation(s). Maintain a health factor above 1.5 to avoid liquidations and penalties.`,
        action: 'Learn Health Factor Management',
        category: 'payment',
        timeEstimate: '30 min read',
        difficulty: 'medium',
      });
    }

    if (breakdown.paymentHistory.evidence?.totalLoans === 0) {
      recommendations.push({
        id: 'first-loan',
        priority: 'high',
        impact: 20,
        title: 'Take Your First Loan',
        description: 'Building payment history starts with your first loan. Start small to minimize risk.',
        action: 'Borrow $100 with Collateral',
        category: 'payment',
        timeEstimate: '5-10 min',
        difficulty: 'easy',
      });
    }
  }

  // Credit Utilization recommendations
  if (breakdown.creditUtilization.score < 70) {
    const utilization = breakdown.creditUtilization.evidence?.rate || 0;

    if (utilization > 0.5) {
      recommendations.push({
        id: 'reduce-utilization',
        priority: 'high',
        impact: 12,
        title: 'Reduce Credit Utilization',
        description: `You're using ${(utilization * 100).toFixed(0)}% of your credit capacity. Aim for below 30% by repaying loans or adding collateral.`,
        action: 'Repay Loan or Add Collateral',
        category: 'utilization',
        timeEstimate: '5 min',
        difficulty: 'easy',
      });
    }
  }

  // KYC recommendations
  if (!sybilData.kyc || sybilData.adjustments.noVerificationPenalty < 0) {
    recommendations.push({
      id: 'complete-kyc',
      priority: 'high',
      impact: 25,
      title: 'Complete KYC Verification',
      description: 'KYC verification with Didit provides a +150 point sybil resistance bonus and unlocks better terms.',
      action: 'Verify Identity (Free)',
      category: 'kyc',
      timeEstimate: '2-3 min',
      difficulty: 'easy',
    });
  }

  // Wallet Age recommendations
  if (sybilData.adjustments.walletAgePenalty < -100) {
    recommendations.push({
      id: 'wallet-age',
      priority: 'medium',
      impact: 10,
      title: 'Build Wallet History',
      description: 'Your wallet is relatively new. Credit scores improve naturally as your wallet ages.',
      action: 'Continue Using DeFi',
        category: 'history',
      timeEstimate: 'Ongoing',
      difficulty: 'easy',
    });
  }

  // Credit Mix recommendations
  if (breakdown.creditMix.score < 60) {
    const protocols = breakdown.creditMix.evidence?.uniqueProtocols?.length || 0;

    if (protocols < 2) {
      recommendations.push({
        id: 'diversify-protocols',
        priority: 'medium',
        impact: 8,
        title: 'Diversify Your Protocol Usage',
        description: `You've used ${protocols} protocol(s). Try borrowing from Aave, Compound, or other protocols to improve your credit mix.`,
        action: 'Explore Other Protocols',
        category: 'mix',
        timeEstimate: '15-30 min',
        difficulty: 'medium',
      });
    }
  }

  // Staking recommendations
  if (sybilData.stake?.amount === 0) {
    recommendations.push({
      id: 'stake-tokens',
      priority: 'low',
      impact: 5,
      title: 'Stake EON Tokens',
      description: 'Staking 100+ EON tokens provides a +25 point sybil resistance bonus and shows long-term commitment.',
      action: 'Stake EON Tokens',
      category: 'security',
      timeEstimate: '5 min',
      difficulty: 'easy',
    });
  }

  // New Credit recommendations
  if (breakdown.newCredit.score < 50) {
    const recentLoans = breakdown.newCredit.evidence?.totalTransactions || 0;

    if (recentLoans > 5) {
      recommendations.push({
        id: 'reduce-new-credit',
        priority: 'medium',
        impact: 6,
        title: 'Space Out Loan Applications',
        description: `You've taken ${recentLoans} loans recently. Rapid borrowing can indicate financial stress. Space out applications.`,
        action: 'Wait Before Next Loan',
        category: 'payment',
        timeEstimate: '7-14 days',
        difficulty: 'easy',
      });
    }
  }

  return recommendations;
}

function getCategoryIcon(category: string) {
  const icons = {
    payment: <CheckCircle2 className="h-4 w-4 text-blue-400" />,
    utilization: <TrendingUp className="h-4 w-4 text-green-400" />,
    history: <Award className="h-4 w-4 text-purple-400" />,
    mix: <Target className="h-4 w-4 text-yellow-400" />,
    kyc: <Shield className="h-4 w-4 text-violet-400" />,
    security: <Shield className="h-4 w-4 text-red-400" />,
  };

  return icons[category as keyof typeof icons] || <AlertCircle className="h-4 w-4" />;
}

function getNextTier(currentTier: string): string {
  const tiers = { Bronze: 'Silver', Silver: 'Gold', Gold: 'Platinum', Platinum: 'Elite' };
  return tiers[currentTier as keyof typeof tiers] || 'Silver';
}

function getNextTierThreshold(currentTier: string): number {
  const thresholds = { Bronze: 60, Silver: 75, Gold: 90, Platinum: 95 };
  return thresholds[currentTier as keyof typeof thresholds] || 60;
}

function getProgressToNextTier(score: number, tier: string): number {
  const currentThreshold = { Bronze: 0, Silver: 60, Gold: 75, Platinum: 90 };
  const nextThreshold = getNextTierThreshold(tier);
  const current = currentThreshold[tier as keyof typeof currentThreshold] || 0;

  return ((score - current) / (nextThreshold - current)) * 100;
}
