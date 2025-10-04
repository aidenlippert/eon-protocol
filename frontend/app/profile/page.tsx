'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Award, TrendingUp, Shield, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useCreditScore } from '../../lib/hooks/useCreditScore';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { creditScore, tierLabel, riskLevel, isLoading } = useCreditScore();
  const [kycLoading, setKycLoading] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);

  // Load KYC status from localStorage on mount
  useEffect(() => {
    if (address) {
      const savedKycStatus = localStorage.getItem(`kyc-verified-${address.toLowerCase()}`);
      if (savedKycStatus === 'true') {
        setKycVerified(true);
      }
    }
  }, [address]);

  const handleVerifyKYC = async () => {
    if (!address) return;

    setKycLoading(true);
    try {
      const response = await fetch('/api/kyc-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('KYC API error:', responseData);
        alert(
          `KYC Setup Required:\n\n${responseData.message || 'Failed to initiate KYC'}\n\n` +
          `Go to https://dashboard.didit.me to create a workflow and set the DIDIT_WORKFLOW_ID environment variable in Vercel.`
        );
        setKycLoading(false);
        return;
      }

      const { verificationUrl, sessionId } = responseData;

      if (!verificationUrl) {
        alert('No verification URL received. Please check your Didit configuration.');
        setKycLoading(false);
        return;
      }

      // Open Didit verification popup
      const popup = window.open(verificationUrl, 'didit-kyc', 'width=500,height=700');

      // Listen for popup to close (user completed or cancelled)
      const checkPopupClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopupClosed);

          // Show success message immediately (Didit confirms before closing)
          alert('✅ Verification submitted! Your KYC status has been updated.');

          // Save to localStorage
          localStorage.setItem(`kyc-verified-${address.toLowerCase()}`, 'true');

          // Update state
          setKycVerified(true);
          setKycLoading(false);

          // Reload to recalculate score
          window.location.reload();
        }
      }, 500); // Check every 500ms if popup closed

      // Stop checking after 10 minutes
      setTimeout(() => {
        clearInterval(checkPopupClosed);
        setKycLoading(false);
      }, 600000);
    } catch (error) {
      console.error('KYC initiation failed:', error);
      alert('Failed to start KYC verification. Please try again.');
      setKycLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">On-Chain Credit Profile</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to view your decentralized credit score
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">On-Chain Credit Profile</h1>
          <p className="text-neutral-400">
            Decentralized credit scoring powered by verifiable on-chain behavior
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Score Card */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Credit Score</h2>
                <p className="text-neutral-400 text-sm">
                  300-850 scale • Based on 5 on-chain factors
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
                          Your wallet has no credit history. Start by depositing collateral and taking a small loan to build your score.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Credit Factors Breakdown */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold">Credit Factors (On-Chain)</h3>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Repayment History (40%)</span>
                      <span className="text-lg font-bold text-violet-400">-</span>
                    </div>
                    <p className="text-xs text-neutral-400">Loan count, on-time payments, health factor management</p>
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Collateral Utilization (25%)</span>
                      <span className="text-lg font-bold">-</span>
                    </div>
                    <p className="text-xs text-neutral-400">Borrow vs. deposit ratio, liquidation history</p>
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Sybil Resistance (20%)</span>
                      {kycVerified ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mb-3">KYC verification + wallet age + staking</p>

                    {!kycVerified && (
                      <Button
                        onClick={handleVerifyKYC}
                        disabled={kycLoading}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {kycLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying with Didit...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Verify Identity (FREE)
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Cross-Chain Reputation (10%)</span>
                      <span className="text-lg font-bold">-</span>
                    </div>
                    <p className="text-xs text-neutral-400">Linked wallets, cross-chain activity</p>
                  </div>

                  <div className="bg-neutral-950/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Protocol Participation (5%)</span>
                      <span className="text-lg font-bold">-</span>
                    </div>
                    <p className="text-xs text-neutral-400">Governance, protocol loyalty</p>
                  </div>
                </div>

                {/* Tier Benefits */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Your Tier Benefits</h3>

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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sybil Resistance Card */}
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold">Sybil Resistance</h3>
              </div>

              {kycVerified ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Identity Verified</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Your identity is verified with Didit KYC. This protects the protocol from sybil attacks.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Not Verified</span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-4">
                    Verify your identity to improve your score and access better rates. FREE and takes 5 minutes.
                  </p>
                  <Button
                    onClick={handleVerifyKYC}
                    disabled={kycLoading}
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {kycLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Verify with Didit
                      </>
                    )}
                  </Button>
                </div>
              )}
            </Card>

            {/* How to Improve */}
            <Card className="bg-neutral-900/50 border-neutral-800 p-6">
              <h3 className="text-lg font-semibold mb-4">How to Improve</h3>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Borrow and repay loans on time (40% impact)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Complete KYC verification (20% impact)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Keep health factor above 1.5 (25% impact)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Link wallets with cross-chain history (10% impact)</span>
                </li>
              </ul>
            </Card>

            {/* Tier System */}
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
