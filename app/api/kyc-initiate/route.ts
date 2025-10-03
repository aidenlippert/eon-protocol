import { NextRequest, NextResponse } from 'next/server';

const DIDIT_API_KEY = process.env.DIDIT_API_KEY || 'qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A';
const DIDIT_API_BASE = 'https://verification.didit.me/v2';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Call Didit API from server to avoid CORS
    const response = await fetch(`${DIDIT_API_BASE}/session/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DIDIT_API_KEY,
        'Authorization': `Bearer ${DIDIT_API_KEY}`,
      },
      body: JSON.stringify({
        vendor_data: walletAddress,
        callback: `${request.nextUrl.origin}/profile?verification=complete`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Didit API error:', errorText);
      return NextResponse.json(
        { error: `Didit API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      verificationUrl: data.url || data.verification_url,
      sessionId: data.session_id || data.sessionId,
    });
  } catch (error) {
    console.error('Failed to initiate KYC:', error);
    return NextResponse.json(
      { error: 'Failed to initiate KYC verification' },
      { status: 500 }
    );
  }
}
