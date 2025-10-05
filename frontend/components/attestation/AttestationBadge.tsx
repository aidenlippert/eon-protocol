'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { colors } from '@/lib/design-tokens';

interface AttestationBadgeProps {
  wallet: string;
  score?: number;
  tier?: string;
  onAttest?: () => void;
}

interface AttestationData {
  hasAttestation: boolean;
  attestationUID: string | null;
  isValid?: boolean;
  data?: {
    user: string;
    score: number;
    tier: string;
    timestamp: number;
  };
  easExplorer?: string;
}

/**
 * @title Attestation Badge Component
 * @notice Displays EAS attestation status and creates new attestations
 * @dev Integrates with /api/attest endpoint
 */
export function AttestationBadge({ wallet, score, tier, onAttest }: AttestationBadgeProps) {
  const [attestation, setAttestation] = useState<AttestationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch existing attestation on mount
  useEffect(() => {
    fetchAttestation();
  }, [wallet]);

  const fetchAttestation = async () => {
    if (!wallet) return;

    try {
      const response = await fetch(`/api/attest?wallet=${wallet}`);
      const data = await response.json();
      setAttestation(data);
    } catch (error) {
      console.error('[Attestation] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAttestation = async () => {
    if (!wallet || !score || !tier) return;

    setCreating(true);
    try {
      const response = await fetch('/api/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, score, tier }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[Attestation] Created:', data);
        // Refresh attestation data
        await fetchAttestation();
        onAttest?.();
      } else {
        console.error('[Attestation] Create error:', data.error);
        alert(`Failed to create attestation: ${data.error}`);
      }
    } catch (error) {
      console.error('[Attestation] Create error:', error);
      alert('Failed to create attestation');
    } finally {
      setCreating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="glassmorphic-card px-6 py-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-700 rounded-full"></div>
          <div className="h-4 bg-neutral-700 rounded w-40"></div>
        </div>
      </div>
    );
  }

  // Has attestation - show verified badge
  if (attestation?.hasAttestation && attestation.isValid) {
    const attestedAt = new Date((attestation.data?.timestamp || 0) * 1000);

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic-card px-6 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Verified checkmark icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            <div>
              <div className="text-lg font-semibold text-white">
                Score Attested On-Chain
              </div>
              <div className="text-sm text-neutral-400">
                {attestedAt.toLocaleDateString()} via Ethereum Attestation Service
              </div>
            </div>
          </div>

          {/* View on EAS Explorer button */}
          {attestation.easExplorer && (
            <a
              href={attestation.easExplorer}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              View Attestation →
            </a>
          )}
        </div>

        {/* Attestation details */}
        <div className="mt-4 pt-4 border-t border-neutral-700/50 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-neutral-400">Attested Score</div>
            <div className="text-white font-semibold">{attestation.data?.score}</div>
          </div>
          <div>
            <div className="text-neutral-400">Attested Tier</div>
            <div className="text-white font-semibold">{attestation.data?.tier}</div>
          </div>
          <div>
            <div className="text-neutral-400">Attestation UID</div>
            <div className="text-white font-mono text-xs">
              {attestation.attestationUID?.slice(0, 8)}...{attestation.attestationUID?.slice(-6)}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // No attestation - show create button
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glassmorphic-card px-6 py-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Unverified icon */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          <div>
            <div className="text-lg font-semibold text-white">
              Create On-Chain Attestation
            </div>
            <div className="text-sm text-neutral-400">
              Permanently verify your {score} credit score via EAS
            </div>
          </div>
        </div>

        {/* Create attestation button */}
        <button
          onClick={createAttestation}
          disabled={creating || !score || !tier}
          className="px-6 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: creating
              ? 'rgba(255, 255, 255, 0.1)'
              : colors.accent.gradient,
            boxShadow: creating
              ? 'none'
              : '0 0 20px rgba(185, 92, 255, 0.3)',
          }}
        >
          {creating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Creating...
            </div>
          ) : (
            'Create Attestation'
          )}
        </button>
      </div>

      {/* Benefits list */}
      <div className="mt-4 pt-4 border-t border-neutral-700/50">
        <div className="text-sm text-neutral-400 mb-2">Benefits:</div>
        <ul className="grid grid-cols-2 gap-2 text-sm text-neutral-300">
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Immutable on-chain proof
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Portable across protocols
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            EAS verification standard
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            Transparent & auditable
          </li>
        </ul>
      </div>
    </motion.div>
  );
}
