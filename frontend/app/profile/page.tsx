'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, ExternalLink, Shield, Award } from 'lucide-react';
import { ScoreGauge } from '@/components/score/ScoreGaugeSimple';
import { FactorBreakdown } from '@/components/score/FactorBreakdown';
import { ActionableRecommendations } from '@/components/score/ActionableRecommendations';
import { ScoreHistoryChart } from '@/components/score/ScoreHistoryChart';
import { DiditWidget } from '@/components/kyc/DiditWidget';
import { getScoreHistory, isKYCVerified } from '@/lib/supabase';

interface ScoreData {
  address: string;
  score: number;
  tier: string;
  baseScore: number;
  breakdown: any;
  sybilResistance: any;
  crossChain: any;
  calculatedAt: string;
  cached: boolean;
  timestamp: string;
}

/**
 * @title Redesigned Profile Page
 * @notice World-class UX for credit score display
 * @dev Uses backend API, Supabase, and beautiful visualizations
 */
export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  // State
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [kycVerified, setKycVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch score from API
  useEffect(() => {
    if (address && isConnected) {
      fetchScore();
      fetchKYCStatus();
      fetchScoreHistory();
    }
  }, [address, isConnected]);

  async function fetchScore() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/score/${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch credit score');
      }

      const data = await response.json();
      setScoreData(data);
    } catch (err: any) {
      console.error('Score fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchKYCStatus() {
    try {
      const verified = await isKYCVerified(address!);
      setKycVerified(verified);
    } catch (err) {
      console.error('KYC status fetch error:', err);
    }
  }

  async function fetchScoreHistory() {
    try {
      const history = await getScoreHistory(address!, 30);
      setScoreHistory(
        history.map((entry) => ({
          date: entry.calculated_at,
          score: entry.score,
        }))
      );
    } catch (err) {
      console.error('Score history fetch error:', err);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`/api/score/${address}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh credit score');
      }

      const data = await response.json();
      setScoreData(data);

      // Refetch history to include new score
      await fetchScoreHistory();
    } catch (err: any) {
      console.error('Score refresh error:', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <Shield className="h-16 w-16 text-violet-400 mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4">On-Chain Credit Profile</h1>
          <p className="text-neutral-400 mb-8 text-lg">
            Connect your wallet to view your decentralized credit score
          </p>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8">
            <p className="text-violet-400">Please connect your wallet to continue</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading && !scoreData) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <Loader2 className="h-12 w-12 animate-spin text-violet-400 mx-auto mb-4" />
          <p className="text-neutral-400">Calculating your credit score...</p>
          <p className="text-sm text-neutral-500 mt-2">
            Analyzing on-chain behavior and DeFi history
          </p>
        </div>
      </div>
    );
  }

  // Error
  if (error && !scoreData) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8">
            <p className="text-red-400 mb-4">Failed to load credit score</p>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <Button onClick={fetchScore} variant="outline" className="border-red-500/30">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!scoreData) return null;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Credit Profile</h1>
            <p className="text-neutral-400">
              Decentralized credit scoring powered by verifiable on-chain behavior
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* KYC Status Badge */}
            {kycVerified && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
                <Shield className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">KYC Verified</span>
              </div>
            )}

            {/* Refresh Button */}
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-neutral-800"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Cache status */}
        {scoreData.cached && (
          <div className="mb-4 text-sm text-neutral-500 flex items-center gap-2">
            <Award className="h-4 w-4" />
            Cached result (updated {new Date(scoreData.calculatedAt).toLocaleString()})
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-neutral-900/50 border border-neutral-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="factors">Factor Breakdown</TabsTrigger>
            <TabsTrigger value="history">History & Trends</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Gauge */}
              <Card className="bg-neutral-900/50 border-neutral-800 p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">Your Credit Score</h2>
                <ScoreGauge
                  score={scoreData.score ?? 0}
                  tier={scoreData.tier ?? 'Bronze'}
                  animated={true}
                />
                <div className="mt-6 text-center text-sm text-neutral-400">
                  <p>Based on 5 on-chain factors</p>
                  <p className="mt-1">
                    Updated: {new Date(scoreData.calculatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Card>

              {/* Actionable Recommendations */}
              <div>
                <ActionableRecommendations
                  currentScore={scoreData.score ?? 0}
                  tier={scoreData.tier ?? 'Bronze'}
                  breakdown={scoreData.breakdown ?? {}}
                  sybilData={scoreData.sybilResistance ?? null}
                />
              </div>
            </div>

            {/* Score History Preview */}
            {scoreHistory.length > 0 && (
              <ScoreHistoryChart data={scoreHistory} currentScore={scoreData.score ?? 0} />
            )}
          </TabsContent>

          {/* Factors Tab */}
          <TabsContent value="factors">
            <FactorBreakdown breakdown={scoreData.breakdown ?? {}} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {scoreHistory.length > 0 ? (
              <>
                <ScoreHistoryChart data={scoreHistory} currentScore={scoreData.score ?? 0} />

                {/* Detailed History Table */}
                <Card className="bg-neutral-900/50 border-neutral-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Detailed History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                            Score
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                            Tier
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-neutral-400">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreHistory.slice(0, 10).map((entry, index) => {
                          const prevEntry = scoreHistory[index + 1];
                          const change = prevEntry ? entry.score - prevEntry.score : 0;

                          return (
                            <tr key={index} className="border-b border-neutral-800/50">
                              <td className="py-3 px-4 text-sm">
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold">{entry.score}</td>
                              <td className="py-3 px-4 text-sm">
                                {getTierForScore(entry.score)}
                              </td>
                              <td className="py-3 px-4 text-sm">
                                {change > 0 && (
                                  <span className="text-green-400">+{change}</span>
                                )}
                                {change < 0 && (
                                  <span className="text-red-400">{change}</span>
                                )}
                                {change === 0 && (
                                  <span className="text-neutral-500">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="bg-neutral-900/50 border-neutral-800 p-12 text-center">
                <Award className="h-16 w-16 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No History Yet</h3>
                <p className="text-neutral-400">
                  Your score will be tracked over time. Check back in a few days to see your
                  trend.
                </p>
              </Card>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* KYC Section */}
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Identity Verification (KYC)</h3>
              <DiditWidget />
            </Card>

            {/* Sybil Resistance Details */}
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Sybil Resistance Score</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Base Score:</span>
                  <span className="font-semibold">{scoreData.sybilResistance.baseScore}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Final Score:</span>
                  <span className="text-2xl font-bold text-violet-400">
                    {scoreData.sybilResistance.finalScore}
                  </span>
                </div>
                <div className="border-t border-neutral-800 pt-4">
                  <h4 className="font-medium mb-3">Adjustments:</h4>
                  {Object.entries(scoreData.sybilResistance.adjustments).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm mb-2">
                      <span className="text-neutral-400">{formatAdjustmentKey(key)}:</span>
                      <span
                        className={
                          Number(value) > 0
                            ? 'text-green-400'
                            : Number(value) < 0
                            ? 'text-red-400'
                            : 'text-neutral-400'
                        }
                      >
                        {Number(value) > 0 ? '+' : ''}
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper functions

function getTierForScore(score: number): string {
  if (score >= 90) return 'Platinum';
  if (score >= 75) return 'Gold';
  if (score >= 60) return 'Silver';
  return 'Bronze';
}

function formatAdjustmentKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
