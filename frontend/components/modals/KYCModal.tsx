'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield } from 'lucide-react';
import { SmartButton } from '@/components/ui/SmartButton';
import { DiditWidget } from '@/components/kyc/DiditWidget';
import { colors } from '@/lib/design-tokens';

interface KYCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * @title KYC Verification Modal
 * @notice Full-screen modal for identity verification
 */
export function KYCModal({ isOpen, onClose }: KYCModalProps) {
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
              className="w-full max-w-2xl rounded-2xl border p-8 relative"
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
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Complete KYC Verification</h2>
                  <p className="text-white/60">Unlock +150 point sybil resistance bonus</p>
                </div>
              </div>

              {/* Benefits */}
              <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-semibold text-white mb-3">Benefits:</h3>
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> +150 point instant score boost
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Sybil resistance verification
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Access to higher tier benefits
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Lower interest rates on loans
                  </li>
                </ul>
              </div>

              {/* Didit Widget */}
              <DiditWidget />

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-white/10 text-center text-xs text-white/40">
                Powered by Didit • Your data is encrypted and never shared
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
