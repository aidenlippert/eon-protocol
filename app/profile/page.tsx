'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { analyzeWalletComprehensive, type EnhancedCreditScoreData } from '@/lib/comprehensive-analyzer';
import { getRecommendedLTV, getInterestRateMultiplier } from '@/lib/real-credit-score';
import { initiateKYCVerification, checkKYCStatus } from '@/lib/didit-kyc';
import { type LinkedWallet } from '@/lib/sybil-resistance';
import { WalletLinker } from '@/components/wallet-linker';
import { Loader2, Award, TrendingUp, ExternalLink, ChevronDown, ChevronUp, Info, Shield, AlertTriangle, CheckCircle2, Globe } from 'lucide-react';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [scoreData, setScoreData] = useState<EnhancedCreditScoreData | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);

  const handleCalculateScore = async () => {
    if (!address) return;

    setLoading(true);
    try {
      // Pass linked wallets to analyzer for bundling bonus
      const data = await analyzeWalletComprehensive(
        address,
        undefined, // KYC will be checked separately
        linkedWallets,
        undefined, // Staking amount
        true // Enable cross-chain
      );
      setScoreData(data);
    } catch (error) {
      console.error('Failed to calculate score:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWallet = async (walletAddress: string) => {
    const newWallet: LinkedWallet = {
      address: walletAddress,
      linkedAt: new Date(),
      verified: false,
      isPrimary: false,
    };

    setLinkedWallets([...linkedWallets, newWallet]);

    // TODO: Store in smart contract or local storage
    // For now, just in state - will recalculate score
    await handleCalculateScore();
  };

  const handleUnlinkWallet = async (walletAddress: string) => {
    setLinkedWallets(linkedWallets.filter(w => w.address !== walletAddress));

    // TODO: Remove from smart contract or local storage
    // For now, just from state - will recalculate score
    await handleCalculateScore();
  };

  const handleVerifyIdentity = async () => {
    if (!address) return;

    setKycLoading(true);
    try {
      // Check if already verified
      const status = await checkKYCStatus(address);
      if (status.verified) {
        alert('You are already verified! Refresh your score to see the bonus.');
        setKycLoading(false);
        return;
      }

      // Initiate KYC
      const { verificationUrl } = await initiateKYCVerification(address);

      // Open Didit verification in new window
      window.open(verificationUrl, '_blank', 'width=500,height=700');

      // Poll for completion
      const checkInterval = setInterval(async () => {
        const updated = await checkKYCStatus(address);
        if (updated.verified) {
          clearInterval(checkInterval);
          alert('KYC verified! Recalculating your score...');
          await handleCalculateScore();
          setKycLoading(false);
        }
      }, 5000); // Check every 5 seconds

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        setKycLoading(false);
      }, 300000);
    } catch (error) {
      console.error('Failed to initiate KYC:', error);
      alert('Failed to start KYC verification. Please try again.');
      setKycLoading(false);
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

  const recommendedLTV = scoreData ? getRecommendedLTV(scoreData.score) : 50;
  const rateMultiplier = scoreData ? getInterestRateMultiplier(scoreData.score) : 1.5;
  const baseRate = 8; // 8% base rate
  const yourRate = Math.round(baseRate * rateMultiplier * 10) / 10;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Credit Profile</h1>
          <p className="text-neutral-400">
            Score calculated using FICO methodology adapted for on-chain data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Credit Score</h2>
                <p className="text-neutral-400 text-sm">
                  300-850 scale (like FICO) • Based on 5 key factors
                </p>
              </div>
              {scoreData && (
                <Badge className={`${
                  scoreData.tier === 'Exceptional' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  scoreData.tier === 'Very Good' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  scoreData.tier === 'Good' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                  scoreData.tier === 'Fair' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {scoreData.tier}
                </Badge>
              )}
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-4 mb-4">
                <div className="text-6xl font-bold text-violet-400">
                  {scoreData?.score ?? '---'}
                </div>
                <div className="text-neutral-400">/ 850</div>
              </div>
              <Progress
                value={scoreData ? ((scoreData.score - 300) / 550) * 100 : 0}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-neutral-500 mt-2">
                <span>300</span>
                <span>500</span>
                <span>670</span>
                <span>850</span>
              </div>
            </div>

            <Button
              onClick={handleCalculateScore}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 mb-6"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Wallet Data...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Calculate My Score
                </>
              )}
            </Button>

            {scoreData && (
              <>
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-100">
                      <div className="font-medium mb-1">How Your Score Works</div>
                      <div className="text-blue-200/80">
                        Like FICO, your score is calculated from 5 factors: Payment History (35%), Credit Utilization (30%),
                        Credit History Length (15%), Credit Mix (10%), and New Credit (10%). Click each factor below to see
                        how you&apos;re scoring.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold mb-4">Score Breakdown (Click for Details)</h3>

                  {/* Payment History */}
                  <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection('payment')}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Payment History</span>
                            <span className="text-xs text-neutral-500">({scoreData.breakdown.paymentHistory.weight}%)</span>
                          </div>
                          <span className="text-sm font-medium">
                            {scoreData.breakdown.paymentHistory.score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress
                          value={scoreData.breakdown.paymentHistory.score}
                          className="h-1.5"
                        />
                      </div>
                      {expandedSection === 'payment' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                    </button>
                    {expandedSection === 'payment' && (
                      <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-neutral-400 text-xs">Total Loans</div>
                            <div className="font-medium">{scoreData.breakdown.paymentHistory.evidence.totalLoans}</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Repaid On Time</div>
                            <div className="font-medium text-green-400">{scoreData.breakdown.paymentHistory.evidence.repaidOnTime}</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Liquidations</div>
                            <div className="font-medium text-red-400">{scoreData.breakdown.paymentHistory.evidence.liquidations}</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Avg Health Factor</div>
                            <div className="font-medium">{scoreData.breakdown.paymentHistory.evidence.avgHealthFactor}</div>
                          </div>
                        </div>
                        <a
                          href={`https://sepolia.arbiscan.io/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 flex items-center gap-1 mt-3"
                        >
                          View payment history on Arbiscan <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Credit Utilization */}
                  <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection('utilization')}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Credit Utilization</span>
                            <span className="text-xs text-neutral-500">({scoreData.breakdown.creditUtilization.weight}%)</span>
                          </div>
                          <span className="text-sm font-medium">
                            {scoreData.breakdown.creditUtilization.score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress
                          value={scoreData.breakdown.creditUtilization.score}
                          className="h-1.5"
                        />
                      </div>
                      {expandedSection === 'utilization' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                    </button>
                    {expandedSection === 'utilization' && (
                      <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm space-y-2">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-neutral-400 text-xs">Current</div>
                            <div className="font-medium">{scoreData.breakdown.creditUtilization.evidence.currentUtilization.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Average</div>
                            <div className="font-medium">{scoreData.breakdown.creditUtilization.evidence.avgUtilization.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Peak</div>
                            <div className="font-medium">{scoreData.breakdown.creditUtilization.evidence.maxUtilization.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="text-neutral-400 text-xs mt-3">
                          💡 Keep utilization below 30% for best score (like a credit card)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Credit History Length */}
                  <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection('history')}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Credit History Length</span>
                            <span className="text-xs text-neutral-500">({scoreData.breakdown.creditHistoryLength.weight}%)</span>
                          </div>
                          <span className="text-sm font-medium">
                            {scoreData.breakdown.creditHistoryLength.score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress
                          value={scoreData.breakdown.creditHistoryLength.score}
                          className="h-1.5"
                        />
                      </div>
                      {expandedSection === 'history' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                    </button>
                    {expandedSection === 'history' && (
                      <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-neutral-400 text-xs">Wallet Age</div>
                            <div className="font-medium">{scoreData.breakdown.creditHistoryLength.evidence.walletAgeInDays} days</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">DeFi Experience</div>
                            <div className="font-medium">{scoreData.breakdown.creditHistoryLength.evidence.defiAgeInDays} days</div>
                          </div>
                        </div>
                        {scoreData.breakdown.creditHistoryLength.evidence.firstDefiInteraction && (
                          <div className="text-neutral-400 text-xs mt-2">
                            First DeFi interaction: {new Date(scoreData.breakdown.creditHistoryLength.evidence.firstDefiInteraction).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Credit Mix */}
                  <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection('mix')}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Credit Mix</span>
                            <span className="text-xs text-neutral-500">({scoreData.breakdown.creditMix.weight}%)</span>
                          </div>
                          <span className="text-sm font-medium">
                            {scoreData.breakdown.creditMix.score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress
                          value={scoreData.breakdown.creditMix.score}
                          className="h-1.5"
                        />
                      </div>
                      {expandedSection === 'mix' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                    </button>
                    {expandedSection === 'mix' && (
                      <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm space-y-3">
                        <div>
                          <div className="text-neutral-400 text-xs mb-1">Protocols Used</div>
                          {scoreData.breakdown.creditMix.evidence.protocolsUsed.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {scoreData.breakdown.creditMix.evidence.protocolsUsed.map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-neutral-500">No protocols used yet</div>
                          )}
                        </div>
                        <div>
                          <div className="text-neutral-400 text-xs mb-1">Asset Types</div>
                          {scoreData.breakdown.creditMix.evidence.assetTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {scoreData.breakdown.creditMix.evidence.assetTypes.map(a => (
                                <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-neutral-500">No assets used yet</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* New Credit */}
                  <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleSection('new')}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">New Credit</span>
                            <span className="text-xs text-neutral-500">({scoreData.breakdown.newCredit.weight}%)</span>
                          </div>
                          <span className="text-sm font-medium">
                            {scoreData.breakdown.newCredit.score.toFixed(1)} / 100
                          </span>
                        </div>
                        <Progress
                          value={scoreData.breakdown.newCredit.score}
                          className="h-1.5"
                        />
                      </div>
                      {expandedSection === 'new' ? <ChevronUp className="ml-4 h-4 w-4" /> : <ChevronDown className="ml-4 h-4 w-4" />}
                    </button>
                    {expandedSection === 'new' && (
                      <div className="p-4 bg-neutral-950/70 border-t border-neutral-800 text-sm space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-neutral-400 text-xs">Recent Loans (30d)</div>
                            <div className="font-medium">{scoreData.breakdown.newCredit.evidence.recentLoans}</div>
                          </div>
                          <div>
                            <div className="text-neutral-400 text-xs">Avg Days Between</div>
                            <div className="font-medium">{scoreData.breakdown.newCredit.evidence.avgTimeBetweenLoans}</div>
                          </div>
                        </div>
                        <div className="text-neutral-400 text-xs mt-2">
                          💡 Spacing out loans shows responsible borrowing behavior
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sybil Resistance Section */}
                {scoreData.sybilResistance && (
                  <div className="mt-8 pt-8 border-t border-neutral-800">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-violet-400" />
                      Sybil Resistance Adjustments
                    </h3>

                    <div className="mb-4 p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-violet-400 mt-0.5" />
                        <div className="text-sm text-violet-100">
                          <div className="font-medium mb-1">What is this?</div>
                          <div className="text-violet-200/80">
                            To prevent users from creating new wallets to reset bad scores, we apply adjustments based on
                            wallet age, identity verification, staking, and wallet bundling. This makes it economically
                            unviable to game the system.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KYC Verification Button */}
                    {scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 && (
                      <div className="mb-4">
                        <Button
                          onClick={handleVerifyIdentity}
                          disabled={kycLoading}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {kycLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying Identity...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Verify Identity with Didit (FREE)
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-center text-neutral-400 mt-2">
                          Complete FREE KYC to remove -150 penalty and get +100-150 bonus
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Base Score (Before Adjustments)</span>
                          <span className="text-lg font-bold text-neutral-300">{scoreData.sybilResistance.baseScore}</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Final Score (After Adjustments)</span>
                          <span className="text-lg font-bold text-violet-400">{scoreData.sybilResistance.finalScore}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-400">Total Adjustment</span>
                          <span className={scoreData.sybilResistance.adjustments.totalAdjustment >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {scoreData.sybilResistance.adjustments.totalAdjustment >= 0 ? '+' : ''}
                            {scoreData.sybilResistance.adjustments.totalAdjustment}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
                          <div className="text-xs text-neutral-400 mb-1">Wallet Age</div>
                          <div className={`text-xl font-bold ${
                            scoreData.sybilResistance.adjustments.walletAgePenalty < 0 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {scoreData.sybilResistance.adjustments.walletAgePenalty}
                          </div>
                          {scoreData.sybilResistance.adjustments.walletAgePenalty < 0 && (
                            <div className="text-xs text-red-400/80 mt-1">
                              New wallet penalty
                            </div>
                          )}
                        </div>

                        <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
                          <div className="text-xs text-neutral-400 mb-1">Identity Verification</div>
                          <div className={`text-xl font-bold ${
                            scoreData.sybilResistance.adjustments.humanityBonus > 0 ? 'text-green-400' :
                            scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 ? 'text-red-400' :
                            'text-neutral-400'
                          }`}>
                            {scoreData.sybilResistance.adjustments.humanityBonus > 0
                              ? `+${scoreData.sybilResistance.adjustments.humanityBonus}`
                              : scoreData.sybilResistance.adjustments.noVerificationPenalty}
                          </div>
                          {scoreData.sybilResistance.adjustments.noVerificationPenalty < 0 && (
                            <div className="text-xs text-red-400/80 mt-1">
                              Not verified
                            </div>
                          )}
                          {scoreData.sybilResistance.adjustments.humanityBonus > 0 && (
                            <div className="text-xs text-green-400/80 mt-1">
                              Verified human
                            </div>
                          )}
                        </div>

                        <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
                          <div className="text-xs text-neutral-400 mb-1">Staking Bonus</div>
                          <div className={`text-xl font-bold ${
                            scoreData.sybilResistance.adjustments.stakingBonus > 0 ? 'text-green-400' : 'text-neutral-400'
                          }`}>
                            {scoreData.sybilResistance.adjustments.stakingBonus > 0
                              ? `+${scoreData.sybilResistance.adjustments.stakingBonus}`
                              : scoreData.sybilResistance.adjustments.stakingBonus}
                          </div>
                          {scoreData.sybilResistance.adjustments.stakingBonus === 0 && (
                            <div className="text-xs text-neutral-400 mt-1">
                              No stake
                            </div>
                          )}
                        </div>

                        <div className="bg-neutral-950/50 rounded-lg border border-neutral-800 p-4">
                          <div className="text-xs text-neutral-400 mb-1">Wallet Bundling</div>
                          <div className={`text-xl font-bold ${
                            scoreData.sybilResistance.adjustments.bundlingBonus > 0 ? 'text-green-400' : 'text-neutral-400'
                          }`}>
                            {scoreData.sybilResistance.adjustments.bundlingBonus > 0
                              ? `+${scoreData.sybilResistance.adjustments.bundlingBonus}`
                              : scoreData.sybilResistance.adjustments.bundlingBonus}
                          </div>
                          {scoreData.sybilResistance.adjustments.bundlingBonus === 0 && (
                            <div className="text-xs text-neutral-400 mt-1">
                              No linked wallets
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sybil Attack Detection */}
                      {scoreData.sybilResistance.sybilCheck.isSuspicious && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                            <div>
                              <div className="font-medium text-red-400 mb-2">
                                Suspicious Activity Detected (Risk Score: {scoreData.sybilResistance.sybilCheck.riskScore}/100)
                              </div>
                              <ul className="space-y-1">
                                {scoreData.sybilResistance.sybilCheck.reasons.map((reason, idx) => (
                                  <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                                    <span className="text-red-400">•</span>
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {scoreData.sybilResistance.recommendations.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                          <div className="font-medium text-blue-400 mb-2">
                            How to Improve Your Score
                          </div>
                          <ul className="space-y-2">
                            {scoreData.sybilResistance.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-blue-300 flex items-start gap-2">
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

              {scoreData ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Max LTV</div>
                    <div className="text-2xl font-bold text-violet-400">{recommendedLTV}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Interest Rate</div>
                    <div className="text-2xl font-bold">{yourRate}%</div>
                    {rateMultiplier < 1 && (
                      <div className="text-xs text-green-400 mt-1">
                        {Math.round((1 - rateMultiplier) * 100)}% discount from base rate
                      </div>
                    )}
                    {rateMultiplier > 1 && (
                      <div className="text-xs text-red-400 mt-1">
                        {Math.round((rateMultiplier - 1) * 100)}% premium over base rate
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Grace Period</div>
                    <div className="text-2xl font-bold">
                      {scoreData.tier === 'Exceptional' ? '72h' :
                       scoreData.tier === 'Very Good' ? '60h' :
                       scoreData.tier === 'Good' ? '48h' :
                       scoreData.tier === 'Fair' ? '36h' : '24h'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-neutral-400 text-sm">
                  Calculate your score to see personalized benefits
                </div>
              )}
            </Card>

            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">How to Improve</h3>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Always repay loans on time (35% of score)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Keep utilization below 30% (30% of score)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Build DeFi history over time (15% of score)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Use diverse protocols and assets (10% of score)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                  <span>Space out loan applications (10% of score)</span>
                </li>
              </ul>
            </Card>

            {/* Cross-Chain Activity Card */}
            {scoreData?.crossChain && (
              <Card className="bg-neutral-900/50 border-neutral-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Cross-Chain Activity</h3>
                    <p className="text-xs text-neutral-400">{scoreData.crossChain.summary}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Active Chains</div>
                    <div className="text-2xl font-bold text-blue-400">{scoreData.crossChain.activeChains}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Protocols Used</div>
                    <div className="text-2xl font-bold">{scoreData.crossChain.totalProtocols}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-400 mb-1">Cross-Chain Bonus</div>
                    <div className="text-2xl font-bold text-green-400">
                      +{scoreData.sybilResistance.adjustments.crossChainBonus}
                    </div>
                  </div>
                </div>

                {scoreData.crossChain.activeChains > 0 && (
                  <div className="mt-4 space-y-2">
                    {scoreData.crossChain.data.chains
                      .filter(chain => chain.transactionCount > 0)
                      .map(chain => (
                        <div key={chain.chainId} className="flex items-center justify-between p-2 bg-neutral-950/50 rounded">
                          <span className="text-sm">{chain.chainName}</span>
                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                            {chain.transactionCount} txs
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            )}

            {/* Wallet Linker Card */}
            {address && (
              <WalletLinker
                primaryWallet={address}
                linkedWallets={linkedWallets}
                onLink={handleLinkWallet}
                onUnlink={handleUnlinkWallet}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
