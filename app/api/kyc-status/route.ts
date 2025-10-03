import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for Map support
export const runtime = 'nodejs';

// In-memory storage for verification status
// In production, use a database like PostgreSQL, MongoDB, or Redis
const verificationCache = new Map<string, {
  verified: boolean;
  verifiedAt: Date;
  sessionId: string;
}>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet')?.toLowerCase();

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address required' },
      { status: 400 }
    );
  }

  const status = verificationCache.get(walletAddress);

  if (!status) {
    return NextResponse.json({
      verified: false,
      verificationId: null,
      verificationDate: null,
      verificationLevel: 'none',
      walletAddress,
      userId: null,
    });
  }

  return NextResponse.json({
    verified: status.verified,
    verificationId: status.sessionId,
    verificationDate: status.verifiedAt,
    verificationLevel: status.verified ? 'basic' : 'none',
    walletAddress,
    userId: null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, verified, sessionId } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const normalizedAddress = walletAddress.toLowerCase();

    verificationCache.set(normalizedAddress, {
      verified,
      verifiedAt: new Date(),
      sessionId: sessionId || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Verification status updated',
      walletAddress: normalizedAddress,
      verified,
    });
  } catch (error) {
    console.error('Error updating KYC status:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
