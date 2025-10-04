import { NextRequest, NextResponse } from 'next/server';

const DIDIT_API_KEY = process.env.DIDIT_API_KEY || '';
const DIDIT_API_URL = 'https://verification.didit.me/v2/session/';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow_id, vendor_data, callback, metadata } = body;

    if (!workflow_id || !vendor_data) {
      return NextResponse.json(
        { error: 'workflow_id and vendor_data are required' },
        { status: 400 }
      );
    }

    // If no API key is set, return a mock session for testing
    if (!DIDIT_API_KEY) {
      console.warn('DIDIT_API_KEY not set - returning mock session');
      return NextResponse.json({
        session_id: 'mock-session-' + Date.now(),
        session_token: 'mock-token',
        status: 'Not Started',
        url: `https://verify.didit.me/${workflow_id}`,
        message: 'Mock session - set DIDIT_API_KEY environment variable for real integration'
      });
    }

    // Create Didit verification session
    const response = await fetch(DIDIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': DIDIT_API_KEY,
      },
      body: JSON.stringify({
        workflow_id,
        vendor_data,
        callback: callback || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/kyc-webhook`,
        metadata: metadata || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Didit API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create Didit session', details: errorData },
        { status: response.status }
      );
    }

    const sessionData = await response.json();

    return NextResponse.json({
      session_id: sessionData.session_id,
      session_token: sessionData.session_token,
      status: sessionData.status,
      url: sessionData.url,
    });

  } catch (error) {
    console.error('KYC session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable GET method
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
