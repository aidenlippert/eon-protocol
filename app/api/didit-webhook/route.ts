import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force Node.js runtime (crypto module not available in Edge)
export const runtime = 'nodejs';

const DIDIT_WEBHOOK_SECRET = 'VB2Kbry-qKa1_BJ_woS5cb5xu2nl5O7TvYuJa0LlBB8';

interface DiditWebhookPayload {
  session_id: string;
  session_number: string;
  vendor_data: string; // This is the wallet address
  status: 'approved' | 'rejected' | 'pending';
  decision: string;
  created_at: string;
  updated_at: string;
  features: {
    id_verification?: { status: string; decision: string };
    face_match?: { status: string; decision: string };
  };
}

/**
 * Verify Didit webhook signature
 * Didit signs webhooks using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Store verification result in our internal API
 */
async function storeVerificationResult(
  walletAddress: string,
  verified: boolean,
  sessionId: string
) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/kyc-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, verified, sessionId }),
    });

    if (!response.ok) {
      console.error('Failed to store verification result');
    }
  } catch (error) {
    console.error('Error storing verification result:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-didit-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, DIDIT_WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: DiditWebhookPayload = JSON.parse(rawBody);

    // Extract wallet address from vendor_data
    const walletAddress = payload.vendor_data;
    const isVerified = payload.status === 'approved';

    console.log('Didit webhook received:', {
      walletAddress,
      status: payload.status,
      sessionId: payload.session_id,
      decision: payload.decision,
    });

    // Store verification result
    await storeVerificationResult(walletAddress, isVerified, payload.session_id);

    // Return success response to Didit
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      walletAddress,
      verified: isVerified,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle GET requests (for webhook verification)
export async function GET() {
  return NextResponse.json({
    message: 'Didit webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
