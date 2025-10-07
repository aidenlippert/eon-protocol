"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link, Unlink, Shield, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useIsRegistered, useLinkedWallets, useLinkWallet, useUnlinkWallet, useMaxLinkedWallets } from "@/lib/hooks/useMultiWallet";
import { isAddress } from "viem";

export function WalletLinkerCard() {
  const { address } = useAccount();
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [error, setError] = useState("");

  // Check if user is registered
  const { isRegistered, isLoading: isCheckingRegistration } = useIsRegistered(address);

  // Get linked wallets
  const { primaryWallet, linkedWallets, totalWallets, isLoading: isLoadingWallets } = useLinkedWallets(address);

  // Link/unlink hooks
  const { linkWallet, isPending: isLinking, isConfirming: isConfirmingLink, isSuccess: isLinkSuccess } = useLinkWallet();
  const { unlinkWallet, isPending: isUnlinking, isConfirming: isConfirmingUnlink } = useUnlinkWallet();

  // Get max wallets limit
  const maxWallets = useMaxLinkedWallets();

  if (!address) {
    return null;
  }

  if (isCheckingRegistration || isLoadingWallets) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            <span className="text-neutral-400">Loading wallet info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isRegistered) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Multiple Wallets
          </CardTitle>
          <CardDescription>Aggregate your credit score across all your wallets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-16 w-16 text-white/10 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white/60 mb-2">KYC Required</h3>
            <p className="text-white/40 mb-6">
              Complete KYC verification to register and link multiple wallets for aggregate credit scoring.
            </p>
            <Button variant="outline" className="border-white/20" disabled>
              Complete KYC First
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleLinkWallet = async () => {
    setError("");

    // Validate address
    if (!newWalletAddress) {
      setError("Please enter a wallet address");
      return;
    }

    if (!isAddress(newWalletAddress)) {
      setError("Invalid wallet address");
      return;
    }

    if (newWalletAddress.toLowerCase() === address.toLowerCase()) {
      setError("Cannot link your current wallet");
      return;
    }

    if (linkedWallets.some(w => w.toLowerCase() === newWalletAddress.toLowerCase())) {
      setError("Wallet already linked");
      return;
    }

    try {
      await linkWallet(newWalletAddress);
      setNewWalletAddress("");
    } catch (err: any) {
      setError(err.message || "Failed to link wallet");
    }
  };

  const handleUnlinkWallet = async (walletAddress: string) => {
    try {
      await unlinkWallet(walletAddress);
    } catch (err: any) {
      setError(err.message || "Failed to unlink wallet");
    }
  };

  const canLinkMore = linkedWallets.length < maxWallets;

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Link className="h-5 w-5" />
              Linked Wallets
            </CardTitle>
            <CardDescription>Manage your linked wallets for aggregate credit scoring</CardDescription>
          </div>
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
            {totalWallets} / {maxWallets + 1} Wallets
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Primary Wallet */}
        <div className="mb-6">
          <div className="text-sm text-white/60 mb-2 font-semibold">Primary Wallet</div>
          <div className="flex items-center justify-between p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-violet-400" />
              <div>
                <div className="text-white font-mono text-sm">{primaryWallet}</div>
                <div className="text-xs text-white/40 mt-1">Cannot be unlinked</div>
              </div>
            </div>
            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">Primary</Badge>
          </div>
        </div>

        {/* Linked Wallets */}
        {linkedWallets.length > 0 && (
          <div className="mb-6">
            <div className="text-sm text-white/60 mb-2 font-semibold">Linked Wallets ({linkedWallets.length})</div>
            <div className="space-y-2">
              {linkedWallets.map((wallet, index) => (
                <div key={wallet} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Link className="h-5 w-5 text-white/60" />
                    <div>
                      <div className="text-white font-mono text-sm">{wallet}</div>
                      <div className="text-xs text-white/40 mt-1">Linked wallet #{index + 1}</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnlinkWallet(wallet)}
                    variant="ghost"
                    size="sm"
                    disabled={isUnlinking || isConfirmingUnlink}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    {isUnlinking || isConfirmingUnlink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Unlink className="h-4 w-4 mr-2" />
                        Unlink
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link New Wallet */}
        {canLinkMore && (
          <div>
            <div className="text-sm text-white/60 mb-2 font-semibold">Link New Wallet</div>
            <div className="space-y-3">
              <Input
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                placeholder="0x..."
                className="bg-white/5 border-white/10 text-white"
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {isLinkSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Wallet linked successfully!
                </div>
              )}
              <Button
                onClick={handleLinkWallet}
                disabled={isLinking || isConfirmingLink || !newWalletAddress}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {isLinking || isConfirmingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isLinking ? "Waiting for confirmation..." : "Linking wallet..."}
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Link Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {!canLinkMore && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-400">
                <div className="font-semibold mb-1">Maximum Wallets Reached</div>
                <div className="text-yellow-400/80">
                  You've reached the maximum of {maxWallets + 1} wallets. Unlink a wallet to add a new one.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-400">
              <div className="font-semibold mb-1">How Multi-Wallet Scoring Works</div>
              <ul className="text-violet-400/80 space-y-1">
                <li>• Your credit score is averaged across all linked wallets</li>
                <li>• Better credit history in one wallet improves your overall score</li>
                <li>• All wallets must belong to the same KYC-verified person</li>
                <li>• Unlinking a wallet removes its data from your aggregate score</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
