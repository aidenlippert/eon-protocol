'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, AlertTriangle, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { RefinanceModal } from './RefinanceModal';

const VAULT_ABI = [
  {
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'amountUsd18', type: 'uint256' },
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface LoanData {
  id: string;
  borrower: string;
  principalUsd18: string;
  repaidUsd18: string;
  timestamp: string;
  status: string;
  collateralToken: string;
  collateralAmount: string;
  aprBps: number;
  currentDebt: string;
  healthFactor: string;
}

export function LoanHistory() {
  const { address } = useAccount();
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanData | null>(null);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showRefinanceModal, setShowRefinanceModal] = useState(false);
  const [refinanceLoanId, setRefinanceLoanId] = useState<string | null>(null);

  // Fetch user's loans from API
  useEffect(() => {
    if (!address) {
      setLoans([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/loans/${address}`)
      .then((res) => res.json())
      .then((data) => {
        setLoans(data.loans || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('[LoanHistory] Error:', err);
        setLoans([]);
        setIsLoading(false);
      });
  }, [address]);

  const refetch = () => {
    if (!address) return;
    fetch(`/api/loans/${address}`)
      .then((res) => res.json())
      .then((data) => setLoans(data.loans || []))
      .catch((err) => console.error('[LoanHistory] Refetch error:', err));
  };

  const activeLoans = loans.filter((loan) => loan.status === 'Active');
  const completedLoans = loans.filter((loan) => loan.status === 'Repaid' || loan.status === 'Liquidated');

  const getHealthColor = (healthFactor: string) => {
    if (healthFactor === '∞') return 'text-green-400';
    const hf = parseFloat(healthFactor);
    if (hf >= 1.2) return 'text-green-400'; // Matches MIN_HEALTH_FACTOR in CreditVaultV3
    if (hf >= 1.1) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthStatus = (healthFactor: string) => {
    if (healthFactor === '∞') return 'Perfect';
    const hf = parseFloat(healthFactor);
    if (hf >= 1.2) return 'Safe'; // Matches MIN_HEALTH_FACTOR in CreditVaultV3
    if (hf >= 1.1) return 'Warning';
    return 'Danger!';
  };

  if (!address) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="text-center text-neutral-400">Connect wallet to view loan history</div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            <span className="text-neutral-400">Loading loan history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Loans */}
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Active Loans
          </CardTitle>
          <CardDescription>
            {activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeLoans.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">No active loans</div>
          ) : (
            <div className="space-y-4">
              {activeLoans.map((loan) => {
                const principalUSD = parseFloat(loan.principalUsd18) / 1e18;
                const debtUSD = parseFloat(loan.currentDebt) / 1e18;
                const interest = debtUSD - principalUSD;
                const daysAgo = Math.floor((Date.now() - Number(loan.timestamp) * 1000) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={loan.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-sm text-white/60 mb-1">Loan #{loan.id}</div>
                        <div className="text-2xl font-bold text-white">${principalUSD.toFixed(2)} USDC</div>
                        <div className="text-sm text-white/50">{daysAgo} days ago</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/60 mb-1">Health Factor</div>
                        <div className={`text-2xl font-bold ${getHealthColor(loan.healthFactor)}`}>
                          {loan.healthFactor}
                        </div>
                        <div className={`text-xs ${getHealthColor(loan.healthFactor)}`}>
                          {getHealthStatus(loan.healthFactor)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-xs text-white/60 mb-1">Total Debt</div>
                        <div className="text-sm font-semibold text-white">${debtUSD.toFixed(2)}</div>
                        {interest > 0 && (
                          <div className="text-xs text-white/50">+${interest.toFixed(2)} interest</div>
                        )}
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-xs text-white/60 mb-1">APR</div>
                        <div className="text-sm font-semibold text-white">{(loan.aprBps / 100).toFixed(1)}%</div>
                      </div>
                    </div>

                    {loan.healthFactor !== '∞' && parseFloat(loan.healthFactor) < 1.2 && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-400">
                          <div className="font-semibold">Liquidation Risk!</div>
                          <div className="text-red-400/80">
                            Health factor below 1.2. Repay now or add collateral to avoid liquidation.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-violet-600 hover:bg-violet-700"
                        onClick={() => {
                          setSelectedLoan(loan);
                          setShowRepayModal(true);
                        }}
                      >
                        Repay Loan
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRefinanceLoanId(loan.id);
                          setShowRefinanceModal(true);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Refinance
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href={`https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESSES[421614].CreditVaultV3}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Loans */}
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Completed Loans
          </CardTitle>
          <CardDescription>
            {completedLoans.length} completed loan{completedLoans.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completedLoans.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">No completed loans</div>
          ) : (
            <div className="space-y-3">
              {completedLoans.map((loan) => {
                const principalUSD = parseFloat(loan.principalUsd18) / 1e18;
                const daysAgo = Math.floor((Date.now() - Number(loan.timestamp) * 1000) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={loan.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm text-white/60 mb-1">Loan #{loan.id}</div>
                      <div className="text-lg font-semibold text-white">${principalUSD.toFixed(2)} USDC</div>
                      <div className="text-xs text-white/50">{daysAgo} days ago</div>
                    </div>
                    <Badge className={loan.status === 'Repaid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                      {loan.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repay Modal */}
      {showRepayModal && selectedLoan && (
        <RepayModal
          loan={selectedLoan}
          onClose={() => {
            setShowRepayModal(false);
            setSelectedLoan(null);
          }}
          onSuccess={() => {
            refetch();
            setShowRepayModal(false);
            setSelectedLoan(null);
          }}
        />
      )}

      {/* Refinance Modal */}
      {showRefinanceModal && refinanceLoanId && (
        <RefinanceModal
          isOpen={showRefinanceModal}
          onClose={() => {
            setShowRefinanceModal(false);
            setRefinanceLoanId(null);
          }}
          loanId={refinanceLoanId}
        />
      )}
    </div>
  );
}

// Repay Modal Component
function RepayModal({
  loan,
  onClose,
  onSuccess,
}: {
  loan: LoanData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Write contract for repayment
  const { data: hash, writeContract, isPending } = useWriteContract();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      setIsProcessing(false);
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  const handleRepay = async () => {
    setIsProcessing(true);

    try {
      // Call repay function with full debt amount
      writeContract({
        address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'repay',
        args: [BigInt(loan.id), BigInt(loan.currentDebt)],
      });
    } catch (error) {
      console.error('[RepayModal] Repayment error:', error);
      setIsProcessing(false);
    }
  };

  const debtUSD = parseFloat(loan.currentDebt) / 1e18;
  const principalUSD = parseFloat(loan.principalUsd18) / 1e18;
  const interest = debtUSD - principalUSD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <h2 className="text-2xl font-bold text-white mb-4">Repay Loan #{loan.id}</h2>

        <div className="mb-6">
          <div className="text-sm text-white/60 mb-2">Total Amount to Repay</div>
          <div className="text-3xl font-bold text-white">${debtUSD.toFixed(2)} USDC</div>

          {interest > 0 && (
            <div className="mt-2 text-sm text-white/50">
              Principal: ${principalUSD.toFixed(2)} + Interest: ${interest.toFixed(2)}
            </div>
          )}
        </div>

        <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="text-sm text-green-400">
            <div className="font-semibold mb-1">✨ Score Boost</div>
            <div className="text-green-400/80">Repaying this loan will increase your score by +25 points!</div>
          </div>
        </div>

        {isProcessing && (
          <div className="mb-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
            <div className="flex items-center gap-2 text-sm text-violet-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isConfirming ? 'Confirming transaction...' : 'Processing repayment...'}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={handleRepay}
            disabled={isProcessing || isPending}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Confirm Repayment'
            )}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
