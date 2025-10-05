'use client';

import { motion } from 'framer-motion';
import { SmartButton } from '@/components/ui/SmartButton';
import { colors } from '@/lib/design-tokens';
import {
  Shield,
  DollarSign,
  TrendingUp,
  Wallet,
  Activity,
  Target,
} from 'lucide-react';

interface ImprovementActionsProps {
  currentScore: number;
  tier: string;
  kycVerified?: boolean;
}

interface ActionCard {
  title: string;
  description: string;
  impact: string;
  points: number;
  icon: any;
  priority: 'high' | 'medium' | 'low';
  action: string;
  onClick: () => void | Promise<void>;
}

/**
 * @title ImprovementActions Component
 * @notice Personalized action cards to improve credit score
 * @dev Implements 6 action cards with SmartButton integration
 */
export function ImprovementActions({
  currentScore,
  tier,
  kycVerified = false,
}: ImprovementActionsProps) {
  const actions: ActionCard[] = [
    {
      title: 'Complete KYC Verification',
      description: 'Verify your identity with Didit to unlock sybil resistance bonus',
      impact: '+150 point boost',
      points: 150,
      icon: Shield,
      priority: kycVerified ? 'low' : 'high',
      action: kycVerified ? '✓ Verified' : 'Verify Identity (Free)',
      onClick: async () => {
        // Trigger KYC modal
        console.log('Opening KYC modal...');
      },
    },
    {
      title: 'Borrow with Collateral',
      description: 'Take a small loan and repay on time to build payment history',
      impact: '+25 pts per loan',
      points: 25,
      icon: DollarSign,
      priority: 'high',
      action: 'Borrow $100',
      onClick: async () => {
        // Trigger borrow modal
        console.log('Opening borrow modal...');
      },
    },
    {
      title: 'Improve Utilization Rate',
      description: 'Reduce your debt-to-collateral ratio below 30%',
      impact: 'Up to +50 pts',
      points: 50,
      icon: TrendingUp,
      priority: 'medium',
      action: 'Add Collateral',
      onClick: async () => {
        console.log('Opening collateral modal...');
      },
    },
    {
      title: 'Diversify DeFi Activity',
      description: 'Interact with 3+ protocols (Aave, Compound, Uniswap)',
      impact: '+30 pts',
      points: 30,
      icon: Activity,
      priority: 'medium',
      action: 'Explore DeFi',
      onClick: async () => {
        console.log('Navigating to DeFi protocols...');
      },
    },
    {
      title: 'Increase Wallet Age',
      description: 'Your wallet is gaining trust over time automatically',
      impact: '+5 pts/month',
      points: 5,
      icon: Wallet,
      priority: 'low',
      action: 'View Timeline',
      onClick: async () => {
        console.log('Showing wallet timeline...');
      },
    },
    {
      title: 'Maintain Good Standing',
      description: 'Avoid new loans for 30 days to boost stability score',
      impact: '+20 pts',
      points: 20,
      icon: Target,
      priority: 'low',
      action: 'Learn More',
      onClick: async () => {
        console.log('Showing stability info...');
      },
    },
  ];

  const priorityColors = {
    high: { border: 'rgba(239, 68, 68, 0.3)', bg: 'rgba(239, 68, 68, 0.05)' },
    medium: { border: 'rgba(245, 158, 11, 0.3)', bg: 'rgba(245, 158, 11, 0.05)' },
    low: { border: 'rgba(59, 130, 246, 0.3)', bg: 'rgba(59, 130, 246, 0.05)' },
  };

  const priorityLabels = {
    high: 'High Impact',
    medium: 'Medium Impact',
    low: 'Low Impact',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Improve Your Score</h2>
          <p className="text-white/60">
            Personalized recommendations to reach the next tier
          </p>
        </div>

        <motion.div
          className="text-right"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
        >
          <div className="text-3xl font-bold" style={{ color: colors.accent.purple }}>
            +{actions.reduce((sum, a) => sum + (a.priority === 'high' ? a.points : 0), 0)}
          </div>
          <div className="text-xs text-white/50">potential increase</div>
        </motion.div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const priorityStyle = priorityColors[action.priority];

          return (
            <motion.div
              key={index}
              className="p-6 rounded-xl border relative overflow-hidden"
              style={{
                background: colors.bg.glass,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(40px)',
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
            >
              {/* Priority Badge */}
              <div
                className="absolute top-4 right-4 px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: priorityStyle.bg,
                  border: `1px solid ${priorityStyle.border}`,
                  color: action.priority === 'high' ? '#ef4444' : action.priority === 'medium' ? '#f59e0b' : '#3b82f6',
                }}
              >
                {priorityLabels[action.priority]}
              </div>

              {/* Icon */}
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
                }}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-white mb-2">{action.title}</h3>
              <p className="text-sm text-white/60 mb-4 min-h-[40px]">{action.description}</p>

              {/* Impact */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="text-2xl font-bold"
                  style={{ color: colors.accent.purple }}
                >
                  {action.impact}
                </div>
              </div>

              {/* Action Button */}
              <SmartButton
                size="sm"
                variant={action.priority === 'high' ? 'primary' : 'secondary'}
                onClick={action.onClick}
                showConfetti={action.priority === 'high' && !kycVerified}
                className="w-full"
              >
                {action.action}
              </SmartButton>

              {/* Time estimate */}
              <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                <span>⏱️ 2-3 min</span>
                <span>
                  {action.priority === 'high' ? '🔥 easy' : action.priority === 'medium' ? '⚡ moderate' : '💡 passive'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
