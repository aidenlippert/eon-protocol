import { NextRequest, NextResponse } from 'next/server';

const DIDIT_API_KEY = process.env.DIDIT_API_KEY || 'qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A';
const DIDIT_API_BASE = 'https://verification.didit.me/v2';
// Default workflow ID - you need to create this in Didit dashboard at https://dashboard.didit.me
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || 'default-kyc-workflow';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log('Initiating KYC for wallet:', walletAddress);

    // Call Didit API from server to avoid CORS
    const response = await fetch(`${DIDIT_API_BASE}/session/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DIDIT_API_KEY,
        'accept': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: walletAddress,
        callback: `${request.nextUrl.origin}/profile?verification=complete`,
      }),
    });

    const responseText = await response.text();
    console.log('Didit API response:', response.status, responseText);

    if (!response.ok) {
      console.error('Didit API error:', response.status, responseText);
      return NextResponse.json(
        {
          error: `Didit API error: ${response.status}`,
          details: responseText,
          message: 'You need to create a workflow in Didit dashboard at https://dashboard.didit.me and set DIDIT_WORKFLOW_ID environment variable'
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    return NextResponse.json({
      verificationUrl: data.url || data.verification_url,
      sessionId: data.session_id || data.sessionId,
    });
  } catch (error) {
    console.error('Failed to initiate KYC:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate KYC verification',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
