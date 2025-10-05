'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import { SmartButton } from '@/components/ui/SmartButton';
import { TransactionStepper } from '@/components/borrow/TransactionStepper';
import { colors } from '@/lib/design-tokens';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
}

interface EstimateData {
  collateral: {
    requiredUSD: number;
    requiredETH: number;
  };
  userBalance: {
    eth: number;
    hasEnough: boolean;
  };
  loanTerms: {
    maxLTV: number;
    apr: number;
  };
}

/**
 * @title Borrow Modal - Production Version
 * @notice Modal for taking real collateralized loans on-chain
 * @dev Integrates with /api/borrow/estimate and /api/borrow/prepare
 *
 * **Flow**:
 * 1. User inputs borrow amount
 * 2. API calculates required collateral based on credit score
 * 3. User confirms and sees TransactionStepper
 * 4. User signs 3 transactions: approve → deposit → borrow
 * 5. Loan is registered on-chain in CreditRegistry
 */
export function BorrowModal({ isOpen, onClose, initialAmount = 100 }: BorrowModalProps) {
  const { address } = useAccount();

  const [amount, setAmount] = useState(initialAmount);
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStepper, setShowStepper] = useState(false);
  const [transactions, setTransactions] = useState<any>(null);

  // Fetch estimate when amount changes
  useEffect(() => {
    if (isOpen && address && amount > 0) {
      fetchEstimate();
    }
  }, [isOpen, address, amount]);

  const fetchEstimate = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/borrow/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          principalUSD: amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch estimate');
      }

      setEstimate(data);
    } catch (err: any) {
      console.error('[BorrowModal] Estimate error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!address || !estimate) return;

    setLoading(true);
    setError(null);

    try {
      // Call /api/borrow/prepare to get transaction data
      const response = await fetch('/api/borrow/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          collateralETH: estimate.collateral.requiredETH,
          principalUSD: amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare transactions');
      }

      console.log('[BorrowModal] Transactions prepared:', data);

      // Open TransactionStepper with prepared transactions
      setTransactions(data.transactions);
      setShowStepper(true);
    } catch (err: any) {
      console.error('[BorrowModal] Prepare error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepperComplete = () => {
    setShowStepper(false);
    onClose();
    // Refresh score after successful borrow
    window.location.reload();
  };

  const handleStepperClose = () => {
    setShowStepper(false);
  };

  const utilizationRate = estimate ? (amount / estimate.collateral.requiredUSD) * 100 : 0;
  const healthFactor = estimate ? estimate.collateral.requiredUSD / amount : 0;
  const hasEnoughBalance = estimate?.userBalance.hasEnough ?? false;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <div
              className="w-full max-w-lg rounded-2xl border p-8 relative"
              style={{
                background: colors.bg.card,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(40px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-6 w-6 text-white/60" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
                  }}
                >
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Borrow with Collateral</h2>
                  <p className="text-white/60">Build payment history • Real on-chain loan</p>
                </div>
              </div>

              {/* Borrow Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Borrow Amount (USDC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    min={10}
                    max={1000}
                    disabled={loading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                    USDC
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  Amount you will receive in USDC stablecoin
                </p>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <span className="ml-3 text-white/60">Calculating requirements...</span>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Estimate Display */}
              {estimate && !loading && (
                <>
                  {/* Required Collateral */}
                  <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-white/80">Required Collateral:</span>
                      <span className="text-2xl font-bold text-white">
                        {estimate.collateral.requiredETH.toFixed(4)} ETH
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      ≈ ${estimate.collateral.requiredUSD.toFixed(2)} USD
                    </div>
                  </div>

                  {/* User Balance */}
                  <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Your Balance:</span>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-white">
                          {estimate.userBalance.eth.toFixed(4)} ETH
                        </div>
                        {!hasEnoughBalance && (
                          <div className="text-xs text-red-400">Insufficient balance</div>
                        )}
                        {hasEnoughBalance && (
                          <div className="text-xs text-green-400">Sufficient balance ✓</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-white/60 mb-1">Max LTV</div>
                      <div className="text-2xl font-bold text-white">
                        {(estimate.loanTerms.maxLTV * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-white/50 mt-1">Based on your score</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-white/60 mb-1">Interest Rate</div>
                      <div className="text-2xl font-bold text-white">
                        {estimate.loanTerms.apr.toFixed(1)}%
                      </div>
                      <div className="text-xs text-white/50 mt-1">APR</div>
                    </div>
                  </div>

                  {/* Health Factor Warning */}
                  {healthFactor < 1.5 && (
                    <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-orange-400">
                        <div className="font-semibold mb-1">Low Health Factor</div>
                        <div className="text-orange-400/80">
                          Your collateral ratio is close to liquidation threshold. Consider borrowing less.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Benefits */}
                  <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="font-semibold text-white mb-2">Credit Score Impact:</h3>
                    <ul className="space-y-1 text-sm text-white/70">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400">+25</span> points on successful repayment
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-400">+10</span> points for building credit history
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-400">-50</span> points if liquidated
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <SmartButton
                  onClick={handleBorrow}
                  disabled={loading || !estimate || !hasEnoughBalance || healthFactor < 1.2}
                  className="flex-1"
                >
                  {loading ? 'Loading...' : `Borrow $${amount}`}
                </SmartButton>
                <SmartButton onClick={onClose} variant="outline">
                  Cancel
                </SmartButton>
              </div>

              {/* Footer */}
              <div className="mt-4 text-center text-xs text-white/40">
                Powered by CreditVault on Arbitrum Sepolia
              </div>
            </div>
          </motion.div>

          {/* Transaction Stepper */}
          {showStepper && transactions && (
            <TransactionStepper
              transactions={transactions}
              onComplete={handleStepperComplete}
              onClose={handleStepperClose}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
