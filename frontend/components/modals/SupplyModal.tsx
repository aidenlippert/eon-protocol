'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, TrendingUp } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

const CREDIT_VAULT_ADDRESS = process.env.NEXT_PUBLIC_CREDIT_VAULT_V3 as `0x${string}`;

const VAULT_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface SupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    symbol: string;
    address: string;
    supplyAPY: string;
    decimals: number;
  };
}

export function SupplyModal({ isOpen, onClose, asset }: SupplyModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSupply = () => {
    setError('');

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    writeContract({
      address: CREDIT_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'supply',
      args: [asset.address as `0x${string}`, parseUnits(amount, asset.decimals)],
    });
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    onClose();
  };

  const estimatedYearlyEarnings = amount ? (Number(amount) * parseFloat(asset.supplyAPY)) / 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Supply {asset.symbol}
          </DialogTitle>
          <DialogDescription className="text-white/60">Supply {asset.symbol} to earn interest</DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2">Supply Successful!</h3>
            <p className="text-white/60 mb-4">
              Your {asset.symbol} is now earning {asset.supplyAPY} APY
            </p>
            <Button onClick={handleClose} className="w-full bg-violet-600 hover:bg-violet-700">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Supply APY */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="text-sm text-green-400/80 mb-1">Supply APY</div>
                <div className="text-3xl font-bold text-green-400">{asset.supplyAPY}</div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Amount to Supply</label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-lg h-12 pr-20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">{asset.symbol}</div>
                </div>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              {/* Estimated Earnings */}
              {amount && Number(amount) > 0 && (
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-sm text-white/60 mb-2">Estimated Earnings</div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-white/50 mb-1">Daily</div>
                      <div className="text-sm font-semibold text-white">
                        ${(estimatedYearlyEarnings / 365).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Monthly</div>
                      <div className="text-sm font-semibold text-white">
                        ${(estimatedYearlyEarnings / 12).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Yearly</div>
                      <div className="text-sm font-semibold text-white">${estimatedYearlyEarnings.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="text-sm text-blue-400">
                  <div className="font-semibold mb-1">How it works:</div>
                  <ul className="space-y-1 text-blue-400/80">
                    <li>• Your {asset.symbol} will be deposited into the lending pool</li>
                    <li>• You'll earn interest from borrowers</li>
                    <li>• Withdraw anytime with no lock-up period</li>
                  </ul>
                </div>
              </div>

              <Button
                onClick={handleSupply}
                disabled={isPending || isConfirming || !amount}
                className="w-full bg-violet-600 hover:bg-violet-700 h-12"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isPending ? 'Submitting...' : 'Confirming...'}
                  </>
                ) : (
                  `Supply ${asset.symbol}`
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
