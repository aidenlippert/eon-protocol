'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ThumbsDown } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const EON_GOVERNOR_ADDRESS = process.env.NEXT_PUBLIC_EON_GOVERNOR as `0x${string}`;

const GOVERNOR_ABI = [
  {
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' }, // 0 = Against, 1 = For, 2 = Abstain
    ],
    name: 'castVote',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: {
    id: number;
    title: string;
    description: string;
    forVotes: string;
    againstVotes: string;
  };
}

export function VoteModal({ isOpen, onClose, proposal }: VoteModalProps) {
  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'abstain' | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleVote = (voteType: 'for' | 'against' | 'abstain') => {
    setSelectedVote(voteType);

    const support = voteType === 'for' ? 1 : voteType === 'against' ? 0 : 2;

    writeContract({
      address: EON_GOVERNOR_ADDRESS,
      abi: GOVERNOR_ABI,
      functionName: 'castVote',
      args: [BigInt(proposal.id), support],
    });
  };

  const handleClose = () => {
    setSelectedVote(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Cast Your Vote</DialogTitle>
          <DialogDescription className="text-white/60">{proposal.title}</DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-bold mb-2">Vote Cast Successfully!</h3>
            <p className="text-white/60 mb-4">Your vote has been recorded on-chain</p>
            <Button onClick={handleClose} className="w-full bg-violet-600 hover:bg-violet-700">
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* Current Vote Distribution */}
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-white/60">Current Results</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-400">For</span>
                    <span className="text-white">{proposal.forVotes}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-400">Against</span>
                    <span className="text-white">{proposal.againstVotes}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: '35%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vote Buttons */}
            <div className="space-y-3 mb-6">
              <Button
                onClick={() => handleVote('for')}
                disabled={isPending || isConfirming}
                className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg"
              >
                {isPending && selectedVote === 'for' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Vote...
                  </>
                ) : isConfirming && selectedVote === 'for' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Vote For
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleVote('against')}
                disabled={isPending || isConfirming}
                className="w-full bg-red-600 hover:bg-red-700 h-14 text-lg"
              >
                {isPending && selectedVote === 'against' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Vote...
                  </>
                ) : isConfirming && selectedVote === 'against' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-5 w-5" />
                    Vote Against
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleVote('abstain')}
                disabled={isPending || isConfirming}
                variant="outline"
                className="w-full h-14 text-lg border-white/20 hover:bg-white/10"
              >
                {isPending && selectedVote === 'abstain' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Vote...
                  </>
                ) : isConfirming && selectedVote === 'abstain' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <ThumbsDown className="mr-2 h-5 w-5" />
                    Abstain
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-white/50 text-center">
              Your voting power is determined by your EON token balance at the proposal snapshot
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
