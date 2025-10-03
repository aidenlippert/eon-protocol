'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type LinkedWallet } from '@/lib/sybil-resistance';
import { Loader2, Plus, X, Link2, CheckCircle2, AlertCircle } from 'lucide-react';

interface WalletLinkerProps {
  primaryWallet: string;
  linkedWallets: LinkedWallet[];
  onLink: (address: string) => Promise<void>;
  onUnlink: (address: string) => Promise<void>;
}

export function WalletLinker({
  primaryWallet,
  linkedWallets,
  onLink,
  onUnlink,
}: WalletLinkerProps) {
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLinkWallet = async () => {
    if (!newWalletAddress) {
      setError('Please enter a wallet address');
      return;
    }

    if (!newWalletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid wallet address format');
      return;
    }

    if (newWalletAddress.toLowerCase() === primaryWallet.toLowerCase()) {
      setError('Cannot link your primary wallet to itself');
      return;
    }

    if (linkedWallets.some(w => w.address.toLowerCase() === newWalletAddress.toLowerCase())) {
      setError('Wallet already linked');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLink(newWalletAddress);
      setNewWalletAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkWallet = async (address: string) => {
    setLoading(true);
    setError(null);

    try {
      await onUnlink(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink wallet');
    } finally {
      setLoading(false);
    }
  };

  const bundleBonus = linkedWallets.length >= 6 ? 50 :
                      linkedWallets.length >= 4 ? 40 :
                      linkedWallets.length >= 2 ? 25 : 0;

  return (
    <Card className="bg-neutral-900/50 border-neutral-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Wallet Bundling</h3>
          <p className="text-sm text-neutral-400">
            Link wallets for transparency bonus
          </p>
        </div>
      </div>

      {/* Current Bonus */}
      <div className="mb-4 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-violet-200">Current Bundling Bonus</span>
          <span className="text-lg font-bold text-violet-400">
            {bundleBonus > 0 ? `+${bundleBonus}` : bundleBonus} points
          </span>
        </div>
        <div className="text-xs text-violet-300 mt-1">
          {linkedWallets.length === 0 && 'Link 2+ wallets to get bonus'}
          {linkedWallets.length === 1 && 'Link 1 more wallet for +25 bonus'}
          {linkedWallets.length >= 2 && linkedWallets.length < 4 && 'Link 2 more wallets for +40 total'}
          {linkedWallets.length >= 4 && linkedWallets.length < 6 && 'Link 2 more wallets for +50 total'}
          {linkedWallets.length >= 6 && 'Maximum bundling bonus!'}
        </div>
      </div>

      {/* Primary Wallet */}
      <div className="mb-4">
        <div className="text-xs text-neutral-400 mb-2">Primary Wallet</div>
        <div className="flex items-center gap-2 p-3 bg-neutral-950/50 rounded-lg border border-neutral-800">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="font-mono text-sm flex-1">
            {primaryWallet.slice(0, 6)}...{primaryWallet.slice(-4)}
          </span>
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            Primary
          </Badge>
        </div>
      </div>

      {/* Linked Wallets */}
      {linkedWallets.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-neutral-400 mb-2">
            Linked Wallets ({linkedWallets.length})
          </div>
          <div className="space-y-2">
            {linkedWallets.map((wallet) => (
              <div
                key={wallet.address}
                className="flex items-center gap-2 p-3 bg-neutral-950/50 rounded-lg border border-neutral-800"
              >
                <Link2 className="h-4 w-4 text-violet-400" />
                <span className="font-mono text-sm flex-1">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
                {wallet.verified && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                    Verified
                  </Badge>
                )}
                <Button
                  onClick={() => handleUnlinkWallet(wallet.address)}
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Wallet */}
      <div>
        <div className="text-xs text-neutral-400 mb-2">Link New Wallet</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newWalletAddress}
            onChange={(e) => {
              setNewWalletAddress(e.target.value);
              setError(null);
            }}
            placeholder="0x..."
            className="flex-1 px-3 py-2 bg-neutral-950/50 border border-neutral-800 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          <Button
            onClick={handleLinkWallet}
            disabled={loading || !newWalletAddress}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Link
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="h-3 w-3 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="text-xs text-yellow-200">
          <span className="font-medium">⚠️ Important:</span> Linked wallets inherit ALL history
          (good AND bad). If any wallet has liquidations or defaults, it affects your entire bundle.
        </div>
      </div>

      {/* Benefits */}
      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium text-neutral-300">Benefits of Wallet Bundling:</div>
        <ul className="space-y-1 text-xs text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>+25-50 score bonus for transparency</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>Aggregate cross-chain history</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>Use oldest wallet age (less penalty)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>Combined protocol diversity bonus</span>
          </li>
        </ul>
      </div>
    </Card>
  );
}
