'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface CreditProfile {
  userAddress: string;
  reputationScore: number;
  ltv: number;
  currentBalance: string;
  availableCredit: string;
  claimsAccepted: number;
  accountAge: number;
  riskTier: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}

interface Claim {
  id: string;
  minBalance: string;
  startBlock: number;
  endBlock: number;
  status: string;
  createdAt: string;
}

export default function Profile() {
  const { address } = useAccount();
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      // TODO: Fetch from Supabase API
      // For now, mock data
      setTimeout(() => {
        setProfile({
          userAddress: address,
          reputationScore: 750,
          ltv: 75,
          currentBalance: '10000000000000000000', // 10 ETH
          availableCredit: '7500000000000000000',  // 7.5 ETH
          claimsAccepted: 1,
          accountAge: 12,
          riskTier: 'C'
        });
        setClaims([
          {
            id: '1',
            minBalance: '10',
            startBlock: 18000000,
            endBlock: 20500000,
            status: 'PENDING',
            createdAt: new Date().toISOString()
          }
        ]);
        setLoading(false);
      }, 1000);
    }
  }, [address]);

  const formatEth = (wei: string) => {
    return (parseInt(wei) / 1e18).toFixed(2);
  };

  const formatDuration = (startBlock: number, endBlock: number) => {
    const blocks = endBlock - startBlock;
    const days = Math.floor(blocks / 6500);
    return `${days} days (~${Math.floor(days / 30)} months)`;
  };

  if (!address) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <Link href="/" className="text-2xl font-bold hover:text-gray-400">EON</Link>
            <ConnectButton />
          </div>

          <div className="border border-gray-800 p-12 rounded-lg text-center">
            <p className="text-2xl mb-6 text-gray-400">Connect wallet to view profile</p>
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <Link href="/" className="text-2xl font-bold hover:text-gray-400">EON</Link>
            <ConnectButton />
          </div>
          <p className="text-2xl text-gray-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <Link href="/" className="text-2xl font-bold hover:text-gray-400">EON</Link>
            <ConnectButton />
          </div>

          <div className="border border-gray-800 p-12 rounded-lg text-center">
            <p className="text-3xl mb-4">No Reputation Yet</p>
            <p className="text-gray-400 mb-8">Submit your first claim to build credit</p>
            <Link
              href="/claim"
              className="inline-block bg-white text-black px-8 py-4 rounded-lg font-bold hover:bg-gray-200 transition"
            >
              Prove Holdings →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <Link href="/" className="text-2xl font-bold hover:text-gray-400">EON</Link>
          <ConnectButton />
        </div>

        <h1 className="text-5xl font-bold mb-2">Your Reputation</h1>
        <p className="text-gray-400 mb-12">{address}</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          <div className="border border-gray-800 p-8 rounded-lg hover:border-gray-600 transition">
            <p className="text-sm text-gray-400 mb-2">Credit Score</p>
            <p className="text-5xl font-bold">{profile.reputationScore}</p>
            <p className="text-sm text-gray-500 mt-2">/1000</p>
          </div>

          <div className="border border-gray-800 p-8 rounded-lg hover:border-gray-600 transition">
            <p className="text-sm text-gray-400 mb-2">Your LTV</p>
            <p className="text-5xl font-bold">{profile.ltv}%</p>
          </div>

          <div className="border border-gray-800 p-8 rounded-lg hover:border-gray-600 transition">
            <p className="text-sm text-gray-400 mb-2">Available Credit</p>
            <p className="text-3xl font-bold">{formatEth(profile.availableCredit)}</p>
            <p className="text-sm text-gray-500 mt-2">ETH</p>
          </div>

          <div className="border border-gray-800 p-8 rounded-lg hover:border-gray-600 transition">
            <p className="text-sm text-gray-400 mb-2">Risk Tier</p>
            <p className="text-5xl font-bold">{profile.riskTier}</p>
          </div>
        </div>

        {/* Borrow CTA */}
        <div className="mb-12">
          <Link
            href="/borrow"
            className="block w-full bg-white text-black font-bold py-6 rounded-lg text-2xl text-center hover:bg-gray-200 transition"
          >
            Borrow ETH →
          </Link>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="border border-gray-800 p-6 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Account Age</p>
            <p className="text-2xl font-bold">{profile.accountAge} months</p>
          </div>

          <div className="border border-gray-800 p-6 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Accepted Claims</p>
            <p className="text-2xl font-bold">{profile.claimsAccepted}</p>
          </div>

          <div className="border border-gray-800 p-6 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Current Balance</p>
            <p className="text-2xl font-bold">{formatEth(profile.currentBalance)} ETH</p>
          </div>
        </div>

        {/* Claims History */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Active Claims</h2>
            <Link
              href="/claim"
              className="text-gray-400 hover:text-white transition"
            >
              Submit New Claim →
            </Link>
          </div>

          {claims.length === 0 ? (
            <div className="border border-gray-800 p-12 rounded-lg text-center">
              <p className="text-gray-400">No active claims</p>
            </div>
          ) : (
            <div className="space-y-4">
              {claims.map(claim => (
                <div key={claim.id} className="border border-gray-800 p-6 rounded-lg hover:border-gray-600 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xl font-bold mb-2">
                        {claim.minBalance} ETH for {formatDuration(claim.startBlock, claim.endBlock)}
                      </p>
                      <p className="text-sm text-gray-400">
                        Blocks {claim.startBlock.toLocaleString()} → {claim.endBlock.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className={`px-4 py-2 rounded-lg text-sm font-bold ${
                        claim.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                        claim.status === 'ACCEPTED' ? 'bg-green-500/20 text-green-500' :
                        claim.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' :
                        'bg-gray-500/20 text-gray-500'
                      }`}>
                        {claim.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>Submitted {new Date(claim.createdAt).toLocaleDateString()}</span>
                    {claim.status === 'PENDING' && (
                      <span>• Challenge period: 6 days remaining</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-12 p-6 border border-gray-800 rounded-lg">
          <h3 className="font-bold mb-4">Reputation Details</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>✓ Score decays 10 points/month without fresh claims</li>
            <li>✓ Submit new claims to maintain/improve reputation</li>
            <li>✓ Higher scores unlock better LTV and lower APR</li>
            <li>✓ Reputation is soulbound (non-transferable)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
