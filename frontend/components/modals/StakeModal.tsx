'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';
import { useStake, useActivateCooldown, useUnstake, useStakerInfo } from '@/lib/hooks/useSafetyModule';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'stake' | 'unstake';
}

export function StakeModal({ isOpen, onClose, type }: StakeModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const { address } = useAccount();
  const { data: stakerInfo } = useStakerInfo(address);

  const { stake, isPending: isStakePending, isConfirming: isStakeConfirming, isSuccess: isStakeSuccess } = useStake();
  const {
    activateCooldown,
    isPending: isCooldownPending,
    isConfirming: isCooldownConfirming,
    isSuccess: isCooldownSuccess,
  } = useActivateCooldown();
  const {
    unstake,
    isPending: isUnstakePending,
    isConfirming: isUnstakeConfirming,
    isSuccess: isUnstakeSuccess,
  } = useUnstake();

  const isPending = isStakePending || isCooldownPending || isUnstakePending;
  const isConfirming = isStakeConfirming || isCooldownConfirming || isUnstakeConfirming;
  const isSuccess = isStakeSuccess || isCooldownSuccess || isUnstakeSuccess;

  const stakedAmount = stakerInfo ? Number(formatEther(stakerInfo[0])) : 0;
  const cooldownStart = stakerInfo ? Number(stakerInfo[1]) : 0;
  const inCooldown = cooldownStart > 0;

  const handleSubmit = () => {
    setError('');

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (type === 'stake') {
      stake(amount);
    } else {
      // Unstaking requires cooldown first
      if (!inCooldown) {
        activateCooldown();
      } else {
        unstake();
      }
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-400" />
            {type === 'stake' ? 'Stake EON' : 'Unstake EON'}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {type === 'stake'
              ? 'Stake EON tokens to earn protocol fees and secure the protocol'
              : 'Unstake your EON tokens (requires 10-day cooldown period)'}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2">
              {type === 'stake' ? 'Staked Successfully!' : 'Cooldown Activated!'}
            </h3>
            <p className="text-white/60 mb-4">
              {type === 'stake'
                ? 'Your EON is now staked and earning rewards'
                : 'Wait 10 days before unstaking. You have a 2-day window to withdraw.'}
            </p>
            <Button onClick={handleClose} className="w-full bg-violet-600 hover:bg-violet-700">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Current Staked Amount */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-sm text-white/60 mb-1">Currently Staked</div>
                <div className="text-2xl font-bold">{stakedAmount.toFixed(2)} EON</div>
              </div>

              {type === 'unstake' && inCooldown && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-yellow-400">Cooldown Active</div>
                      <div className="text-sm text-yellow-400/80 mt-1">
                        You can unstake after the 10-day cooldown period. Make sure to withdraw within the 2-day window.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {type === 'stake' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-white/70 mb-2 block">Amount to Stake</label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-lg h-12"
                    />
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="text-sm text-blue-400">
                      <div className="font-semibold mb-1">Benefits:</div>
                      <ul className="space-y-1 text-blue-400/80">
                        <li>• Earn protocol fees from flash loans and borrowing</li>
                        <li>• Help secure the protocol against shortfalls</li>
                        <li>• Participate in protocol governance</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {type === 'unstake' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-400">Important:</div>
                      <ul className="text-sm text-red-400/80 mt-1 space-y-1">
                        <li>• 10-day cooldown period before you can withdraw</li>
                        <li>• 2-day unstake window after cooldown</li>
                        <li>• Staked tokens may be slashed up to 30% during shortfall events</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isPending || isConfirming || (type === 'stake' && !amount)}
                className="w-full bg-violet-600 hover:bg-violet-700 h-12"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isPending ? 'Submitting...' : 'Confirming...'}
                  </>
                ) : type === 'stake' ? (
                  'Stake EON'
                ) : inCooldown ? (
                  'Unstake Now'
                ) : (
                  'Activate Cooldown'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
