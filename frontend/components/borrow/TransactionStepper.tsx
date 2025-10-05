'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { colors } from '@/lib/design-tokens';

interface Transaction {
  to: string;
  data: string;
  value: string;
  description: string;
  required: boolean;
  gasEstimate: number;
}

interface TransactionStepperProps {
  transactions: {
    approve?: Transaction;
    deposit: Transaction;
    borrow: Transaction;
  };
  onComplete: () => void;
  onClose: () => void;
}

type StepStatus = 'pending' | 'in_progress' | 'success' | 'error';

interface Step {
  id: string;
  title: string;
  description: string;
  transaction: Transaction | null;
  status: StepStatus;
  txHash?: string;
  error?: string;
}

/**
 * @title Transaction Stepper Component
 * @notice Guides users through 3-step borrowing flow with blockchain transactions
 * @dev Integrates with wagmi for wallet interactions
 *
 * **Flow**:
 * 1. [Optional] Approve → User approves vault to spend WETH
 * 2. Deposit → User deposits ETH as collateral (with msg.value)
 * 3. Borrow → User borrows USDC against collateral
 *
 * **UX**:
 * - Shows step-by-step progress with animations
 * - Displays transaction hashes with Arbiscan links
 * - Handles errors gracefully with retry option
 * - Celebrates success with confetti
 */
export function TransactionStepper({
  transactions,
  onComplete,
  onClose,
}: TransactionStepperProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'deposit',
      title: 'Deposit Collateral',
      description: transactions.deposit.description,
      transaction: transactions.deposit,
      status: 'pending',
    },
    {
      id: 'borrow',
      title: 'Borrow Funds',
      description: transactions.borrow.description,
      transaction: transactions.borrow,
      status: 'pending',
    },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const executeStep = async (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step.transaction || !walletClient || !publicClient || !address) return;

    // Update step status to in_progress
    updateStepStatus(stepIndex, 'in_progress');

    try {
      console.log(`[TransactionStepper] Executing step: ${step.title}`);

      // Send transaction
      const hash = await walletClient.sendTransaction({
        account: address,
        to: step.transaction.to as `0x${string}`,
        data: step.transaction.data as `0x${string}`,
        value: BigInt(step.transaction.value),
      });

      console.log(`[TransactionStepper] Transaction hash: ${hash}`);

      // Update step with txHash
      updateStep(stepIndex, { txHash: hash });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        console.log(`[TransactionStepper] Transaction confirmed: ${hash}`);
        updateStepStatus(stepIndex, 'success');

        // Move to next step or complete
        if (stepIndex < steps.length - 1) {
          setCurrentStepIndex(stepIndex + 1);
        } else {
          // All steps complete!
          celebrateSuccess();
          setTimeout(() => {
            onComplete();
          }, 2000);
        }
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error(`[TransactionStepper] Error in step ${step.title}:`, error);

      const errorMessage = error.message || 'Transaction failed';
      updateStep(stepIndex, {
        status: 'error',
        error: errorMessage,
      });
    }
  };

  const updateStepStatus = (index: number, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, status } : step))
    );
  };

  const updateStep = (index: number, updates: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
  };

  const retryStep = (stepIndex: number) => {
    updateStep(stepIndex, { status: 'pending', error: undefined, txHash: undefined });
    executeStep(stepIndex);
  };

  const celebrateSuccess = () => {
    // Success celebration removed - clean UI
    console.log('[TransactionStepper] All transactions completed successfully!');
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-2xl glassmorphic-card p-8"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h2 className="text-3xl font-bold mb-2 text-white">Complete Borrow</h2>
          <p className="text-neutral-400 mb-8">
            Sign each transaction in your wallet to complete the borrowing process
          </p>

          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isActive={currentStepIndex === index}
                onExecute={() => executeStep(index)}
                onRetry={() => retryStep(index)}
              />
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-8 w-full py-3 px-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Individual step card component
function StepCard({
  step,
  index,
  isActive,
  onExecute,
  onRetry,
}: {
  step: Step;
  index: number;
  isActive: boolean;
  onExecute: () => void;
  onRetry: () => void;
}) {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'success':
        return <Check className="w-6 h-6 text-green-400" />;
      case 'in_progress':
        return <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-400" />;
      default:
        return (
          <div className="w-6 h-6 rounded-full border-2 border-neutral-600 flex items-center justify-center text-xs text-neutral-600">
            {index + 1}
          </div>
        );
    }
  };

  const getStatusColor = () => {
    switch (step.status) {
      case 'success':
        return 'border-green-500/50 bg-green-500/10';
      case 'in_progress':
        return 'border-blue-500/50 bg-blue-500/10';
      case 'error':
        return 'border-red-500/50 bg-red-500/10';
      default:
        return isActive ? 'border-violet-500/50 bg-violet-500/10' : 'border-neutral-700 bg-neutral-800/50';
    }
  };

  return (
    <motion.div
      className={`border rounded-xl p-6 transition-all ${getStatusColor()}`}
      initial={false}
      animate={{
        scale: isActive ? 1.02 : 1,
        boxShadow: isActive ? '0 0 30px rgba(139, 92, 246, 0.3)' : '0 0 0 rgba(0,0,0,0)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className="mt-1">{getStatusIcon()}</div>

        <div className="flex-1">
          <h3 className="text-xl font-semibold text-white mb-1">{step.title}</h3>
          <p className="text-sm text-neutral-400 mb-4">{step.description}</p>

          {/* Transaction hash */}
          {step.txHash && (
            <a
              href={`https://sepolia.arbiscan.io/tx/${step.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-4"
            >
              View on Arbiscan <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Error message */}
          {step.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">{step.error}</p>
            </div>
          )}

          {/* Action button */}
          {isActive && step.status === 'pending' && (
            <button
              onClick={onExecute}
              className="px-6 py-2 rounded-lg font-semibold text-white transition-all"
              style={{
                background: colors.accent.gradient,
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
              }}
            >
              Sign Transaction
            </button>
          )}

          {step.status === 'error' && (
            <button
              onClick={onRetry}
              className="px-6 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-500 text-white transition-all"
            >
              Retry Transaction
            </button>
          )}

          {step.status === 'in_progress' && (
            <div className="flex items-center gap-2 text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Waiting for confirmation...</span>
            </div>
          )}

          {step.status === 'success' && (
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-semibold">Transaction confirmed!</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
