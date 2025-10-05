'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface FactorData {
  score: number;
  weight: number;
  evidence: any;
}

interface FactorBreakdownProps {
  breakdown: {
    paymentHistory: FactorData;
    creditUtilization: FactorData;
    creditHistoryLength: FactorData;
    creditMix: FactorData;
    newCredit: FactorData;
  };
}

/**
 * @title Factor Breakdown Component
 * @notice Visual breakdown of 5 credit factors with evidence
 * @dev Shows score, weight, and actionable insights for each factor
 */
export function FactorBreakdown({ breakdown }: FactorBreakdownProps) {
  const factors = [
    {
      name: 'Payment History',
      key: 'paymentHistory',
      icon: '💳',
      description: 'Loan repayment track record',
      weight: breakdown.paymentHistory.weight,
      score: breakdown.paymentHistory.score,
      evidence: breakdown.paymentHistory.evidence,
      insights: getPaymentInsights(breakdown.paymentHistory),
    },
    {
      name: 'Credit Utilization',
      key: 'creditUtilization',
      icon: '📊',
      description: 'Collateral usage vs. capacity',
      weight: breakdown.creditUtilization.weight,
      score: breakdown.creditUtilization.score,
      evidence: breakdown.creditUtilization.evidence,
      insights: getUtilizationInsights(breakdown.creditUtilization),
    },
    {
      name: 'Credit History Length',
      key: 'creditHistoryLength',
      icon: '📅',
      description: 'Wallet age and DeFi experience',
      weight: breakdown.creditHistoryLength.weight,
      score: breakdown.creditHistoryLength.score,
      evidence: breakdown.creditHistoryLength.evidence,
      insights: getHistoryInsights(breakdown.creditHistoryLength),
    },
    {
      name: 'Credit Mix',
      key: 'creditMix',
      icon: '🎯',
      description: 'Protocol and asset diversity',
      weight: breakdown.creditMix.weight,
      score: breakdown.creditMix.score,
      evidence: breakdown.creditMix.evidence,
      insights: getMixInsights(breakdown.creditMix),
    },
    {
      name: 'New Credit',
      key: 'newCredit',
      icon: '⚡',
      description: 'Recent borrowing activity',
      weight: breakdown.newCredit.weight,
      score: breakdown.newCredit.score,
      evidence: breakdown.newCredit.evidence,
      insights: getNewCreditInsights(breakdown.newCredit),
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-6">Credit Factor Breakdown</h3>

      {factors.map((factor) => (
        <Card
          key={factor.key}
          className="bg-neutral-900/50 border-neutral-800 p-6 hover:border-neutral-700 transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{factor.icon}</span>
              <div>
                <h4 className="font-semibold text-lg">{factor.name}</h4>
                <p className="text-sm text-neutral-400">{factor.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-400">{factor.score}</div>
              <div className="text-xs text-neutral-500">Weight: {factor.weight}%</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <Progress
              value={factor.score}
              className="h-2"
              indicatorClassName={getProgressColor(factor.score)}
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>Poor</span>
              <span>Fair</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-neutral-950/50 rounded-lg p-4 mb-3">
            <div className="text-xs font-medium text-neutral-400 mb-2">Evidence:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(factor.evidence).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-neutral-400">{formatEvidenceKey(key)}:</span>
                  <span className="font-medium">{formatEvidenceValue(key, value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          {factor.insights && (
            <div className="flex items-start gap-2 text-sm">
              {factor.insights.type === 'positive' && (
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              )}
              {factor.insights.type === 'warning' && (
                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              )}
              {factor.insights.type === 'negative' && (
                <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <div className="font-medium mb-1">{factor.insights.title}</div>
                <div className="text-neutral-400">{factor.insights.message}</div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// Helper functions

function getProgressColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function formatEvidenceKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatEvidenceValue(key: string, value: any): string {
  if (typeof value === 'number') {
    if (key.includes('Ratio') || key.includes('Factor')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (key.includes('Days')) {
      return `${value} days`;
    }
    return value.toLocaleString();
  }
  if (Array.isArray(value)) {
    return value.length.toString();
  }
  return String(value);
}

function getPaymentInsights(data: FactorData) {
  const { totalLoans, repaidOnTime, liquidations } = data.evidence;

  if (totalLoans === 0) {
    return {
      type: 'warning',
      title: 'No Payment History',
      message: 'Take a small loan and repay it on time to build your payment history.',
    };
  }

  if (liquidations > 0) {
    return {
      type: 'negative',
      title: 'Liquidation History Detected',
      message: `You have ${liquidations} liquidation(s). Improve your health factor management to avoid future liquidations.`,
    };
  }

  const repaymentRate = (repaidOnTime / totalLoans) * 100;

  if (repaymentRate >= 90) {
    return {
      type: 'positive',
      title: 'Excellent Payment History',
      message: `${repaymentRate.toFixed(0)}% on-time repayment rate. Keep maintaining this strong track record!`,
    };
  }

  return {
    type: 'warning',
    title: 'Room for Improvement',
    message: `Current repayment rate: ${repaymentRate.toFixed(0)}%. Aim for 90%+ to improve your score.`,
  };
}

function getUtilizationInsights(data: FactorData) {
  const { currentUtilization, maxUtilization } = data.evidence;

  if (currentUtilization === 0) {
    return {
      type: 'warning',
      title: 'No Active Loans',
      message: 'Maintaining low utilization is good, but having some active credit shows responsible usage.',
    };
  }

  if (currentUtilization < 30) {
    return {
      type: 'positive',
      title: 'Low Utilization',
      message: `Excellent! You're using only ${(currentUtilization * 100).toFixed(0)}% of your available credit capacity.`,
    };
  }

  if (currentUtilization > 70) {
    return {
      type: 'negative',
      title: 'High Utilization',
      message: `You're using ${(currentUtilization * 100).toFixed(0)}% of capacity. Consider repaying loans or adding collateral to reduce risk.`,
    };
  }

  return {
    type: 'warning',
    title: 'Moderate Utilization',
    message: `Current utilization: ${(currentUtilization * 100).toFixed(0)}%. Keep it below 30% for best score impact.`,
  };
}

function getHistoryInsights(data: FactorData) {
  const { walletAgeInDays, defiAgeInDays } = data.evidence;

  if (walletAgeInDays < 30) {
    return {
      type: 'warning',
      title: 'New Wallet',
      message: 'Your wallet is less than 30 days old. Credit history length improves over time.',
    };
  }

  if (walletAgeInDays >= 365) {
    return {
      type: 'positive',
      title: 'Established Wallet',
      message: `Your wallet is over ${Math.floor(walletAgeInDays / 30)} months old. Strong credit history length!`,
    };
  }

  return {
    type: 'warning',
    title: 'Building History',
    message: `Wallet age: ${walletAgeInDays} days. Continue building your on-chain credit history.`,
  };
}

function getMixInsights(data: FactorData) {
  // V2 structure uses uniqueProtocols, legacy uses protocolsUsed
  const protocolsUsed = data.evidence?.uniqueProtocols || data.evidence?.protocolsUsed || [];
  const assetTypes = data.evidence?.assetTypes || [];

  if (protocolsUsed.length === 0) {
    return {
      type: 'warning',
      title: 'No DeFi Activity',
      message: 'Use multiple lending protocols and assets to diversify your credit mix.',
    };
  }

  if (protocolsUsed.length >= 3 && assetTypes.length >= 2) {
    return {
      type: 'positive',
      title: 'Diverse Credit Mix',
      message: `You've used ${protocolsUsed.length} protocols and ${assetTypes.length} asset types. Excellent diversity!`,
    };
  }

  return {
    type: 'warning',
    title: 'Limited Diversity',
    message: `Try using more protocols (${protocolsUsed.length}) and asset types (${assetTypes.length}) to improve your mix.`,
  };
}

function getNewCreditInsights(data: FactorData) {
  const recentLoans = data.evidence?.totalTransactions || data.evidence?.recentLoans || 0;
  const hardInquiries = data.evidence?.hardInquiries || 0;

  if (recentLoans === 0) {
    return {
      type: 'positive',
      title: 'Stable Credit Usage',
      message: 'No recent loan applications. This shows stability and reduces inquiry risk.',
    };
  }

  if (recentLoans > 5) {
    return {
      type: 'negative',
      title: 'High Recent Activity',
      message: `${recentLoans} loans in the last 30 days. Rapid credit seeking can indicate financial stress.`,
    };
  }

  return {
    type: 'warning',
    title: 'Moderate New Credit',
    message: `${recentLoans} recent loan(s). Space out borrowing to avoid appearing credit-hungry.`,
  };
}
