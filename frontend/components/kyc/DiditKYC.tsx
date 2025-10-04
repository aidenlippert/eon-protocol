"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Shield, AlertCircle, Loader2 } from "lucide-react";
import { useKYCStatus } from "@/lib/hooks/useKYC";

// Didit Configuration - Your workflow ID
const DIDIT_WORKFLOW_ID = "54740218";

export function DiditKYC() {
  const { address, isConnected } = useAccount();
  const { isVerified, kycProof } = useKYCStatus(address);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartKYC = () => {
    if (!address) return;

    setIsLoading(true);

    try {
      // Didit Chrome Extension Method
      // The extension listens for this message and opens the verification flow
      window.postMessage(
        {
          type: 'DIDIT_START_VERIFICATION',
          payload: {
            workflowId: DIDIT_WORKFLOW_ID,
            walletAddress: address,
          },
        },
        '*'
      );

      // Listen for completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'DIDIT_VERIFICATION_COMPLETE') {
          console.log('Didit verification complete:', event.data.payload);
          setIsLoading(false);

          // Show success message
          alert('✅ KYC Verification Complete! Your proof has been recorded.');

          // Refresh to update score
          window.location.reload();
        } else if (event.data.type === 'DIDIT_VERIFICATION_ERROR') {
          console.error('Didit verification error:', event.data.payload);
          setIsLoading(false);
          alert('❌ Verification failed. Please try again.');
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        setIsLoading(false);
      }, 300000);

    } catch (error) {
      console.error('Failed to start Didit:', error);
      setIsLoading(false);

      // Fallback: open Didit website
      window.open(`https://www.didit.me/verify?workflow=${DIDIT_WORKFLOW_ID}`, '_blank');
    }
  };

  if (!isConnected || !address) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC Verification
          </CardTitle>
          <CardDescription>
            Boost your score +150 points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Connect wallet to verify
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KYC Verification
        </CardTitle>
        <CardDescription>
          Boost your score +150 points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified ? (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">✅ Verified</div>
              <div className="text-xs mt-1">
                Verified: {kycProof?.verifiedAt ? new Date(Number(kycProof.verifiedAt) * 1000).toLocaleDateString() : 'N/A'}
              </div>
              <div className="text-xs text-green-400 mt-1">
                +150 points added to your score
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete KYC verification to unlock +150 score bonus
              </AlertDescription>
            </Alert>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              onClick={handleStartKYC}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Verification...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Start KYC with Didit
                </>
              )}
            </Button>

            <div className="text-xs text-neutral-400 space-y-1">
              <p>• Uses Didit Chrome Extension</p>
              <p>• Privacy-first verification</p>
              <p>• Only credential hash stored on-chain</p>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-neutral-800">
          <div className="text-sm text-neutral-400 space-y-1">
            <div className="flex justify-between">
              <span>Privacy-First</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between">
              <span>On-Chain Proof</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between">
              <span>Score Bonus</span>
              <span className="text-violet-400 font-semibold">+150</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
