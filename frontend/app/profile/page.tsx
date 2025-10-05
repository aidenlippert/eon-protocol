'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { SmartButton } from '@/components/ui/SmartButton';
import { CreditScoreCard } from '@/components/profile/CreditScoreCard';
import { TierProgressBar } from '@/components/profile/TierProgressBar';
import { ImprovementActions } from '@/components/profile/ImprovementActions';
import { AttestationBadge } from '@/components/attestation/AttestationBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FactorBreakdown } from '@/components/score/FactorBreakdown';
import { ScoreHistoryChart } from '@/components/score/ScoreHistoryChart';
import { DiditWidget } from '@/components/kyc/DiditWidget';
import { getScoreHistory, isKYCVerified } from '@/lib/supabase';
import { colors } from '@/lib/design-tokens';

interface ScoreData {
  address: string;
  score: number;
  tier: string;
  baseScore: number;
  breakdown: any;
  sybilResistance: any;
  crossChain: any;
  calculatedAt: string;
  cached: boolean;
  timestamp: string;
}

/**
 * @title Modern Credit Profile Page
 * @notice World-class UX with glassmorphism and animations
 * @dev Implements complete UI_WIREFRAME.md design system
 */
export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [kycVerified, setKycVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (address && isConnected) {
      fetchScore();
      fetchKYCStatus();
      fetchScoreHistory();
    }
  }, [address, isConnected]);

  async function fetchScore() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/score/${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch credit score');
      }

      const data = await response.json();
      setScoreData(data);
    } catch (err: any) {
      console.error('Score fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchKYCStatus() {
    try {
      const verified = await isKYCVerified(address!);
      setKycVerified(verified);
    } catch (err) {
      console.error('KYC status fetch error:', err);
    }
  }

  async function fetchScoreHistory() {
    try {
      const history = await getScoreHistory(address!, 30);
      setScoreHistory(
        history.map((entry) => ({
          date: entry.calculated_at,
          score: entry.score,
        }))
      );
    } catch (err) {
      console.error('Score history fetch error:', err);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`/api/score/${address}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh credit score');
      }

      const data = await response.json();
      setScoreData(data);
      await fetchScoreHistory();
    } catch (err: any) {
      console.error('Score refresh error:', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  // Not connected
  if (!isConnected) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: colors.bg.primary }}
      >
        <motion.div
          className="max-w-md w-full p-8 rounded-2xl border text-center"
          style={{
            background: colors.bg.glass,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(40px)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Shield className="h-16 w-16 mx-auto mb-6" style={{ color: colors.accent.purple }} />
          <h1 className="text-3xl font-bold text-white mb-3">On-Chain Credit Profile</h1>
          <p className="text-white/60 mb-6">
            Connect your wallet to view your decentralized credit score
          </p>
        </motion.div>
      </div>
    );
  }

  // Loading
  if (loading && !scoreData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: colors.bg.primary }}
      >
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2
            className="h-12 w-12 animate-spin mx-auto mb-4"
            style={{ color: colors.accent.purple }}
          />
          <p className="text-white/60">Calculating your credit score...</p>
          <p className="text-sm text-white/40 mt-2">
            Analyzing on-chain behavior and DeFi history
          </p>
        </motion.div>
      </div>
    );
  }

  // Error
  if (error && !scoreData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: colors.bg.primary }}
      >
        <div
          className="max-w-md w-full p-8 rounded-2xl border text-center"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <p className="text-red-400 mb-4 font-semibold">Failed to load credit score</p>
          <p className="text-sm text-white/60 mb-6">{error}</p>
          <SmartButton onClick={fetchScore} variant="outline">
            Try Again
          </SmartButton>
        </div>
      </div>
    );
  }

  if (!scoreData) return null;

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ background: colors.bg.primary }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Credit Profile
            </h1>
            <p className="text-white/60">
              Decentralized credit scoring powered by verifiable on-chain behavior
            </p>
          </div>

          <div className="flex items-center gap-3">
            {kycVerified && (
              <motion.div
                className="flex items-center gap-2 px-4 py-2 rounded-full border"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <Shield className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">KYC Verified</span>
              </motion.div>
            )}

            <SmartButton
              onClick={handleRefresh}
              variant="secondary"
              size="sm"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </SmartButton>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Score Display */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CreditScoreCard
              score={scoreData.score ?? 0}
              tier={scoreData.tier ?? 'Bronze'}
              animated={true}
            />
          </motion.div>

          {/* Right Column - Tier Progress */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <TierProgressBar
              currentScore={scoreData.score ?? 0}
              currentTier={scoreData.tier ?? 'Bronze'}
            />
          </motion.div>
        </div>

        {/* EAS Attestation Badge */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AttestationBadge
            wallet={address || ''}
            score={scoreData.score}
            tier={scoreData.tier}
            onAttest={() => {
              console.log('[Profile] Attestation created');
            }}
          />
        </motion.div>

        {/* Improvement Actions */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ImprovementActions
            currentScore={scoreData.score ?? 0}
            tier={scoreData.tier ?? 'Bronze'}
            kycVerified={kycVerified}
          />
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs defaultValue="breakdown" className="space-y-6">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="breakdown">Factor Breakdown</TabsTrigger>
              <TabsTrigger value="history">History & Trends</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="breakdown">
              <FactorBreakdown breakdown={scoreData.breakdown ?? {}} />
            </TabsContent>

            <TabsContent value="history">
              {scoreHistory.length > 0 ? (
                <ScoreHistoryChart
                  data={scoreHistory}
                  currentScore={scoreData.score ?? 0}
                />
              ) : (
                <div
                  className="p-12 rounded-2xl border text-center"
                  style={{
                    background: colors.bg.glass,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <p className="text-white/60">
                    No history yet. Check back in a few days to see your trend.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="security">
              <div
                className="p-6 rounded-2xl border"
                style={{
                  background: colors.bg.glass,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <h3 className="text-xl font-semibold text-white mb-4">
                  Identity Verification (KYC)
                </h3>
                <DiditWidget />
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Cache Notice */}
        {scoreData.cached && (
          <motion.div
            className="mt-6 text-sm text-white/40 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Cached result • Updated {new Date(scoreData.calculatedAt).toLocaleString()}
          </motion.div>
        )}
      </div>
    </div>
  );
}
