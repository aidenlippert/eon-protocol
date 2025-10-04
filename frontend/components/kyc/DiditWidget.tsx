"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Shield, AlertCircle, Loader2, X } from "lucide-react";
import { useKYCStatus } from "@/lib/hooks/useKYC";

// Your Didit Workflow ID from console
const DIDIT_WORKFLOW_ID = "54740218-aecf-4d4d-a2f8-a200fb9e8b34";

export function DiditWidget() {
  const { address, isConnected } = useAccount();
  const { isVerified, kycProof } = useKYCStatus(address);
  const [showWidget, setShowWidget] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for messages from Didit iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: only accept messages from Didit domains
      if (!event.origin.includes('didit.me')) return;

      console.log('Didit message:', event.data);

      // Handle different event types from Didit
      if (event.data.type === 'VERIFICATION_COMPLETE' ||
          event.data.status === 'Approved' ||
          event.data.event === 'session.approved') {

        console.log('✅ Verification approved!');
        setShowWidget(false);
        alert('✅ KYC Verification Complete!\n\nYour identity has been verified. +150 score bonus will be applied after on-chain proof submission.');

        // TODO: Auto-submit proof to contract
        // window.location.reload();
      } else if (event.data.type === 'VERIFICATION_FAILED' ||
                 event.data.status === 'Declined' ||
                 event.data.event === 'session.declined') {

        console.log('❌ Verification declined');
        setShowWidget(false);
        alert('❌ Verification was declined. Please try again with valid documents.');
      } else if (event.data.event === 'session.abandoned') {
        console.log('User abandoned verification');
        setShowWidget(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const createSession = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!address) return;

    setIsCreatingSession(true);

    try {
      // Call your backend API to create Didit session
      const response = await fetch('/api/kyc-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID,
          vendor_data: address,
          callback: `${window.location.origin}/api/kyc-webhook`,
          metadata: {
            wallet_address: address,
            timestamp: Date.now(),
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        alert(`Failed to create verification session:\n\n${data.error || data.message || 'Unknown error'}\n\nCheck console for details.`);
        setIsCreatingSession(false);
        return;
      }

      console.log('Session created:', data);

      if (data.url) {
        console.log('✅ Opening verification iframe with URL:', data.url);
        console.log('✅ Setting showWidget to TRUE');
        setSessionUrl(data.url);
        setShowWidget(true);

        // Prevent any navigation
        setTimeout(() => {
          console.log('✅ Widget should be visible now. showWidget =', true);
        }, 100);
      } else {
        console.error('❌ No URL in response:', data);
        alert('No verification URL received. Check console for details.');
      }
    } catch (error) {
      console.error('Session creation failed:', error);
      alert(`Failed to start verification:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck browser console for details.`);
    } finally {
      setIsCreatingSession(false);
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
              Connect wallet to start verification
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                type="button"
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={createSession}
                disabled={isCreatingSession || showWidget}
              >
                {isCreatingSession ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting verification...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Start KYC Verification
                  </>
                )}
              </Button>

              <div className="bg-neutral-950/50 rounded-lg p-3 space-y-2">
                <div className="text-xs font-semibold text-neutral-300">Verification includes:</div>
                <div className="text-xs text-neutral-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-violet-400" />
                    <span>ID Document verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-violet-400" />
                    <span>Liveness detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-violet-400" />
                    <span>Face match (1:1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-violet-400" />
                    <span>IP Analysis</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Powered by Didit • Privacy-first • 2-3 minutes</span>
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
        </CardContent>
      </Card>

      {/* Didit Verification Widget Overlay */}
      {showWidget && sessionUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 rounded-lg shadow-2xl w-full max-w-lg relative">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold">KYC Verification</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowWidget(false);
                  setSessionUrl(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative" style={{ height: '600px' }}>
              <iframe
                ref={iframeRef}
                src={sessionUrl}
                className="w-full h-full"
                allow="camera; microphone"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
