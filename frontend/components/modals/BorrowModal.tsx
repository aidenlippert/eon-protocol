'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { SmartButton } from '@/components/ui/SmartButton';
import { colors } from '@/lib/design-tokens';
import { useState } from 'react';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * @title Borrow Modal
 * @notice Modal for taking collateralized loans
 */
export function BorrowModal({ isOpen, onClose }: BorrowModalProps) {
  const [amount, setAmount] = useState(100);
  const [collateral, setCollateral] = useState(150);

  const utilizationRate = (amount / collateral) * 100;
  const healthFactor = collateral / amount;

  const handleBorrow = async () => {
    // TODO: Integrate with CreditVault contract
    console.log('Borrowing', amount, 'with collateral', collateral);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onClose();
  };

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
                  <p className="text-white/60">Build payment history • Earn +25 pts</p>
                </div>
              </div>

              {/* Borrow Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Borrow Amount (USD)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  min={10}
                  max={1000}
                />
              </div>

              {/* Collateral Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Collateral (ETH value in USD)
                </label>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  min={amount * 1.2}
                />
                <p className="text-xs text-white/50 mt-1">
                  Minimum 120% collateralization required
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Utilization Rate</div>
                  <div
                    className="text-2xl font-bold"
                    style={{
                      color:
                        utilizationRate > 80
                          ? '#ef4444'
                          : utilizationRate > 50
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  >
                    {utilizationRate.toFixed(1)}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Health Factor</div>
                  <div
                    className="text-2xl font-bold"
                    style={{
                      color:
                        healthFactor < 1.2
                          ? '#ef4444'
                          : healthFactor < 1.5
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  >
                    {healthFactor.toFixed(2)}x
                  </div>
                </div>
              </div>

              {/* Warning */}
              {healthFactor < 1.5 && (
                <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-400">
                    <div className="font-semibold mb-1">Low Health Factor</div>
                    <div className="text-orange-400/80">
                      Your collateral is close to liquidation threshold. Consider adding more
                      collateral.
                    </div>
                  </div>
                </div>
              )}

              {/* Benefits */}
              <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-semibold text-white mb-2">Score Impact:</h3>
                <ul className="space-y-1 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">+25</span> points on successful repayment
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">+10</span> points for account maturity
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-400">-50</span> points if liquidated
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <SmartButton
                  onClick={handleBorrow}
                  disabled={healthFactor < 1.2}
                  className="flex-1"
                  showConfetti
                >
                  Borrow ${amount}
                </SmartButton>
                <SmartButton onClick={onClose} variant="outline">
                  Cancel
                </SmartButton>
              </div>

              {/* Footer */}
              <div className="mt-4 text-center text-xs text-white/40">
                Interest rate: 5% APR • No fees
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
