'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { analyzeWallet, calculateRealScore, type WalletAnalysis, type DeFiInteraction } from '@/lib/transaction-analyzer';
import { Loader2, Award, TrendingUp, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [scoreData, setScoreData] = useState<ReturnType<typeof calculateRealScore> | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleCalculateScore = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const walletAnalysis = await analyzeWallet(address);
      const score = calculateRealScore(walletAnalysis);
      setAnalysis(walletAnalysis);
      setScoreData(score);
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

  const getCreditTier = (score: number) => {
    if (score >= 800) return 'Platinum';
    if (score >= 650) return 'Gold';
    if (score >= 500) return 'Silver';
    return 'Bronze';
  };

  const tier = scoreData ? getCreditTier(scoreData.total) : 'Bronze';
  const ltv = tier === 'Platinum' ? 90 : tier === 'Gold' ? 75 : tier === 'Silver' ? 65 : 50;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

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
                <p className="text-neutral-400">Based on REAL on-chain transaction history</p>
              </div>
              <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                {tier}
              </Badge>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-4 mb-4">
                <div className="text-6xl font-bold text-violet-400">
                  {scoreData?.total ?? '---'}
                </div>
                <div className="text-neutral-400">/ 1000</div>
              </div>
              <Progress value={scoreData ? (scoreData.total / 1000) * 100 : 0} className="h-2" />
            </div>

            <Button
              onClick={handleCalculateScore}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching Real Transaction Data from Arbiscan...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Analyze My Wallet
                </>
              )}
            </Button>

            {analysis && scoreData && (
              <div className="mt-8 space-y-3">
                <h3 className="text-lg font-semibold mb-4">Score Breakdown (Click for Proof)</h3>

                {/* Wallet Age */}
                <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                  <button
                    onClick={() => toggleSection('walletAge')}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">Wallet Age</span>
                        <span className="text-sm font-medium">
                          {scoreData.breakdown.walletAge.score} / {scoreData.breakdown.walletAge.max}
                        </span>
                      </div>
                      <Progress value={(scoreData.breakdown.walletAge.score / scoreData.breakdown.walletAge.max) * 100} className="h-1" />
                    </div>
                    {expandedSection === 'walletAge' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                  </button>
                  {expandedSection === 'walletAge' && (
                    <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm">
                      <div className="text-neutral-300 mb-2">{scoreData.breakdown.walletAge.evidence}</div>
                      <a
                        href={`https://sepolia.arbiscan.io/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        View on Arbiscan <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Transaction Volume */}
                <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                  <button
                    onClick={() => toggleSection('txVolume')}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">Transaction Volume</span>
                        <span className="text-sm font-medium">
                          {scoreData.breakdown.txVolume.score} / {scoreData.breakdown.txVolume.max}
                        </span>
                      </div>
                      <Progress value={(scoreData.breakdown.txVolume.score / scoreData.breakdown.txVolume.max) * 100} className="h-1" />
                    </div>
                    {expandedSection === 'txVolume' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                  </button>
                  {expandedSection === 'txVolume' && (
                    <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm">
                      <div className="text-neutral-300 mb-2">{scoreData.breakdown.txVolume.evidence}</div>
                      <a
                        href={`https://sepolia.arbiscan.io/address/${address}#transactions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        View all transactions <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* DeFi Interactions */}
                <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                  <button
                    onClick={() => toggleSection('defi')}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">DeFi Interactions</span>
                        <span className="text-sm font-medium">
                          {scoreData.breakdown.defiInteractions.score} / {scoreData.breakdown.defiInteractions.max}
                        </span>
                      </div>
                      <Progress value={(scoreData.breakdown.defiInteractions.score / scoreData.breakdown.defiInteractions.max) * 100} className="h-1" />
                    </div>
                    {expandedSection === 'defi' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                  </button>
                  {expandedSection === 'defi' && (
                    <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm">
                      <div className="text-neutral-300 mb-3">{scoreData.breakdown.defiInteractions.evidence}</div>
                      {analysis.defiInteractions.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {analysis.defiInteractions.slice(0, 10).map((interaction, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-neutral-900/50 rounded">
                              <div>
                                <div className="font-medium">{interaction.protocol}</div>
                                <div className="text-xs text-neutral-400">{new Date(interaction.timestamp * 1000).toLocaleDateString()}</div>
                              </div>
                              <a
                                href={`https://sepolia.arbiscan.io/tx/${interaction.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-violet-400 hover:text-violet-300"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-neutral-400">No DeFi interactions found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Liquidation History */}
                <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                  <button
                    onClick={() => toggleSection('liquidation')}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">Liquidation History</span>
                        <span className="text-sm font-medium">
                          {scoreData.breakdown.liquidationHistory.score} / {scoreData.breakdown.liquidationHistory.max}
                        </span>
                      </div>
                      <Progress value={(scoreData.breakdown.liquidationHistory.score / scoreData.breakdown.liquidationHistory.max) * 100} className="h-1" />
                    </div>
                    {expandedSection === 'liquidation' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                  </button>
                  {expandedSection === 'liquidation' && (
                    <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm">
                      <div className="text-neutral-300">{scoreData.breakdown.liquidationHistory.evidence}</div>
                    </div>
                  )}
                </div>

                {/* Repayment History */}
                <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                  <button
                    onClick={() => toggleSection('repayment')}
                    className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-400">Repayment History</span>
                        <span className="text-sm font-medium">
                          {scoreData.breakdown.repaymentHistory.score} / {scoreData.breakdown.repaymentHistory.max}
                        </span>
                      </div>
                      <Progress value={(scoreData.breakdown.repaymentHistory.score / scoreData.breakdown.repaymentHistory.max) * 100} className="h-1" />
                    </div>
                    {expandedSection === 'repayment' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                  </button>
                  {expandedSection === 'repayment' && (
                    <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm">
                      <div className="text-neutral-300">{scoreData.breakdown.repaymentHistory.evidence}</div>
                    </div>
                  )}
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
                  <span>Interact with DeFi protocols (Aave, Uniswap, GMX)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Avoid failed transactions (100% success rate is best)</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
