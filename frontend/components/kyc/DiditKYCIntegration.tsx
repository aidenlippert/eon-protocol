"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Shield, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useKYCStatus } from "@/lib/hooks/useKYC";

// Your Didit Workflow ID from the console
const DIDIT_WORKFLOW_ID = "54740218";
const DIDIT_SESSION_URL = `https://verify.didit.me/${DIDIT_WORKFLOW_ID}`;

export function DiditKYCIntegration() {
  const { address, isConnected } = useAccount();
  const { isVerified, kycProof } = useKYCStatus(address);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartKYC = () => {
    if (!address) return;

    setIsProcessing(true);

    // Open Didit verification in new window
    const width = 500;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const verificationWindow = window.open(
      DIDIT_SESSION_URL,
      'didit-kyc',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    // Listen for messages from Didit verification window
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Didit domain
      if (!event.origin.includes('didit.me')) return;

      console.log('Didit message received:', event.data);

      if (event.data.type === 'VERIFICATION_SUCCESS' || event.data.status === 'success') {
        console.log('✅ Didit verification completed!', event.data);

        setIsProcessing(false);
        verificationWindow?.close();

        // Show success message
        alert('✅ KYC Verification Complete!\n\nNow submit your proof on-chain to get +150 score bonus.');

        // TODO: Integrate with contract to submit proof
        // This would call: registry.submitKYCProof(credentialHash, expiresAt, signature)

        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'VERIFICATION_ERROR' || event.data.status === 'error') {
        console.error('❌ Didit verification failed:', event.data);
        setIsProcessing(false);
        verificationWindow?.close();
        alert('❌ Verification failed. Please try again.');
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if window was closed without completing
    const checkWindowClosed = setInterval(() => {
      if (verificationWindow?.closed) {
        clearInterval(checkWindowClosed);
        setIsProcessing(false);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);

    // Cleanup after 10 minutes
    setTimeout(() => {
      clearInterval(checkWindowClosed);
      window.removeEventListener('message', handleMessage);
      setIsProcessing(false);
    }, 600000);
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
              Connect wallet to start verification
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
              <div className="text-xs text-green-400 mt-1 font-semibold">
                +150 points added to your score
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete ID verification to unlock +150 score bonus
              </AlertDescription>
            </Alert>

            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              onClick={handleStartKYC}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verification in progress...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Start KYC Verification
                </>
              )}
            </Button>

            <div className="bg-neutral-950/50 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-neutral-300">What you'll need:</div>
              <div className="text-xs text-neutral-400 space-y-1">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Valid government-issued ID</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>Camera access for liveness check</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>2-3 minutes to complete</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-neutral-500 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Powered by Didit • Privacy-first • On-chain proof</span>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-neutral-800">
          <div className="text-sm text-neutral-400 space-y-2">
            <div className="flex justify-between items-center">
              <span>Privacy-First</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between items-center">
              <span>On-Chain Proof</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between items-center">
              <span>Score Bonus</span>
              <span className="text-violet-400 font-bold text-base">+150</span>
            </div>
          </div>
        </div>

        {/* Debug info for testing */}
        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer hover:text-neutral-500">Debug Info</summary>
          <div className="mt-2 space-y-1">
            <div>Workflow ID: {DIDIT_WORKFLOW_ID}</div>
            <div>Session URL: {DIDIT_SESSION_URL}</div>
            <div>Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
