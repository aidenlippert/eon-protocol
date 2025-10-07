'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Users } from 'lucide-react';
import { useDelegate } from '@/lib/hooks/useGovernance';
import { isAddress } from 'viem';

interface DelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDelegate?: string;
}

export function DelegateModal({ isOpen, onClose, currentDelegate }: DelegateModalProps) {
  const [delegateAddress, setDelegateAddress] = useState('');
  const [error, setError] = useState('');

  const { delegate, isPending, isConfirming, isSuccess } = useDelegate();

  const handleDelegate = () => {
    setError('');

    if (!delegateAddress) {
      setError('Please enter an address');
      return;
    }

    if (!isAddress(delegateAddress)) {
      setError('Invalid Ethereum address');
      return;
    }

    delegate(delegateAddress);
  };

  const handleClose = () => {
    setDelegateAddress('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Delegate Voting Power</DialogTitle>
          <DialogDescription className="text-white/60">
            Delegate your voting power to another address
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2">Delegation Successful!</h3>
            <p className="text-white/60 mb-4">Your voting power has been delegated</p>
            <Button onClick={handleClose} className="w-full bg-violet-600 hover:bg-violet-700">
              Close
            </Button>
          </div>
        ) : (
          <>
            {currentDelegate && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-blue-400">Currently Delegated To:</div>
                    <div className="text-sm text-white/80 font-mono">{currentDelegate}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Delegate Address</label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={delegateAddress}
                  onChange={(e) => setDelegateAddress(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="text-sm text-yellow-400">
                  <div className="font-semibold mb-1">Important:</div>
                  <ul className="space-y-1 text-yellow-400/80">
                    <li>• You can delegate to yourself to vote directly</li>
                    <li>• Delegation doesn't transfer tokens, only voting power</li>
                    <li>• You can change delegation at any time</li>
                  </ul>
                </div>
              </div>

              <Button
                onClick={handleDelegate}
                disabled={isPending || isConfirming || !delegateAddress}
                className="w-full bg-violet-600 hover:bg-violet-700 h-12"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isPending ? 'Submitting...' : 'Confirming...'}
                  </>
                ) : (
                  'Delegate Voting Power'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
