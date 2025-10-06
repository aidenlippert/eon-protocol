'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingDown, DollarSign, Percent, Calendar, Sparkles } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';

interface RefinanceData {
  worthIt: boolean;
  loanId: string;
  currentAPR: number;
  newAPR: number;
  score: number;
  principal: number;
  collateral: number;
  totalDebt: number;
  savings: {
    annual: number;
    monthly: number;
    percentage: number;
  };
}

interface RefinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
}

export function RefinanceModal({ isOpen, onClose, loanId }: RefinanceModalProps) {
  const { address } = useAccount();
  const [refinanceData, setRefinanceData] = useState<RefinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fetch refinancing terms
  const calculateRefinancing = async () => {
    if (!address) return;

    setIsCalculating(true);
    try {
      const res = await fetch('/api/loans/refinance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId, borrower: address }),
      });

      const data = await res.json();
      setRefinanceData(data);

      if (!data.worthIt) {
        toast.info(data.message || 'Refinancing not beneficial at current score');
      }
    } catch (error: any) {
      console.error('Refinancing calculation failed:', error);
      toast.error('Failed to calculate refinancing terms');
    } finally {
      setIsCalculating(false);
    }
  };

  // Execute refinancing
  const executeRefinancing = async () => {
    if (!refinanceData || !address) return;

    setIsLoading(true);
    try {
      // Get transaction steps
      const res = await fetch('/api/loans/refinance/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId }),
      });

      const { steps } = await res.json();

      // Execute repay transaction (step 1)
      if (steps.length > 0) {
        writeContract({
          address: steps[0].to as `0x${string}`,
          abi: [{ type: 'function', name: 'repayLoan', inputs: [{ type: 'uint256' }], outputs: [] }],
          functionName: 'repayLoan',
          args: [BigInt(loanId)],
        });

        toast.success('Refinancing initiated! Check your wallet.');
      }
    } catch (error: any) {
      console.error('Refinancing execution failed:', error);
      toast.error('Refinancing failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate when modal opens
  useState(() => {
    if (isOpen && !refinanceData) {
      calculateRefinancing();
    }
  });

  if (isSuccess) {
    setTimeout(() => {
      toast.success('Loan refinanced successfully! 🎉');
      onClose();
    }, 1000);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-black/90 border border-violet-500/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-400" />
            Refinance Loan #{loanId}
          </DialogTitle>
        </DialogHeader>

        {isCalculating && (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">Calculating refinancing terms...</p>
          </div>
        )}

        {refinanceData && !refinanceData.worthIt && (
          <div className="py-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-yellow-400">
                Your score hasn't improved enough to make refinancing worthwhile.
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Current APR: {refinanceData.currentAPR}% → Potential: {refinanceData.newAPR}%
              </p>
            </div>
          </div>
        )}

        {refinanceData && refinanceData.worthIt && (
          <div className="space-y-4">
            {/* APR Improvement */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">APR Reduction</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    -{refinanceData.savings.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">
                    {refinanceData.currentAPR}% → {refinanceData.newAPR}%
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-violet-400" />
                  <span className="text-sm text-gray-400">Monthly Savings</span>
                </div>
                <div className="text-xl font-bold text-violet-300">
                  ${refinanceData.savings.monthly.toFixed(2)}
                </div>
              </div>

              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-violet-400" />
                  <span className="text-sm text-gray-400">Annual Savings</span>
                </div>
                <div className="text-xl font-bold text-violet-300">
                  ${refinanceData.savings.annual.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Principal</span>
                <span className="text-white font-medium">${refinanceData.principal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Collateral</span>
                <span className="text-white font-medium">${refinanceData.collateral.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Debt</span>
                <span className="text-white font-medium">${refinanceData.totalDebt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                <span className="text-gray-400">Credit Score</span>
                <span className="text-violet-400 font-bold">{refinanceData.score}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading || isConfirming}
              >
                Cancel
              </Button>
              <Button
                onClick={executeRefinancing}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                disabled={isLoading || isConfirming}
              >
                {isConfirming ? 'Confirming...' : isLoading ? 'Processing...' : 'Refinance Now'}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Note: You'll need sufficient funds to repay the current loan before refinancing
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
