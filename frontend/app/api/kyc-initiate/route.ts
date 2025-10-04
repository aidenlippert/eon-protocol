import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // For now, return a mock response
    // In production, this would integrate with Didit API
    return NextResponse.json({
      success: true,
      message: 'KYC initiation placeholder - integrate with Didit API',
      workflowId: '54740218',
      redirectUrl: 'https://www.didit.me/',
    });
  } catch (error) {
    console.error('KYC initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate KYC' },
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
