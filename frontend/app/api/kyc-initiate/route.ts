import { NextRequest, NextResponse } from 'next/server';

const DIDIT_API_KEY = process.env.DIDIT_API_KEY || '';
const DIDIT_API_URL = 'https://verification.didit.me/v2/session/';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow_id, vendor_data, callback, metadata } = body;

    console.log('=== KYC Session Creation ===');
    console.log('API Key present:', !!DIDIT_API_KEY);
    console.log('Workflow ID:', workflow_id);
    console.log('Vendor data:', vendor_data);

    if (!workflow_id || !vendor_data) {
      return NextResponse.json(
        { error: 'workflow_id and vendor_data are required' },
        { status: 400 }
      );
    }

    // If no API key is set, return error
    if (!DIDIT_API_KEY) {
      console.error('❌ DIDIT_API_KEY not set!');
      return NextResponse.json({
        error: 'DIDIT_API_KEY not configured',
        message: 'Please add DIDIT_API_KEY to environment variables'
      }, { status: 500 });
    }

    // Create Didit verification session
    console.log('Calling Didit API...');
    const diditResponse = await fetch(DIDIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': DIDIT_API_KEY,
      },
      body: JSON.stringify({
        workflow_id,
        vendor_data,
        callback: callback || `${process.env.NEXT_PUBLIC_APP_URL || 'https://eon-protocol.vercel.app'}/api/kyc-webhook`,
        metadata: metadata || {},
      }),
    });

    console.log('Didit API status:', diditResponse.status);

    if (!diditResponse.ok) {
      const errorText = await diditResponse.text();
      console.error('❌ Didit API error:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      return NextResponse.json(
        {
          error: 'Failed to create Didit session',
          details: errorData,
          status: diditResponse.status
        },
        { status: diditResponse.status }
      );
    }

    const sessionData = await diditResponse.json();
    console.log('✅ Session created:', sessionData.session_id);
    console.log('Session URL:', sessionData.url);

    return NextResponse.json({
      session_id: sessionData.session_id,
      session_token: sessionData.session_token,
      status: sessionData.status,
      url: sessionData.url,
    });

  } catch (error) {
    console.error('❌ KYC session creation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
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
