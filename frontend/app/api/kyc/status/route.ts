import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';

/**
 * @title KYC Status API
 * @notice Server-side KYC verification check (avoids 406 CORS issues)
 * @dev Uses Supabase service role key for secure access
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[KYC API] Supabase not configured, returning false');
      return NextResponse.json({
        verified: false,
        provider: null,
        created_at: null,
        message: 'KYC service not configured',
      });
    }

    // Import Supabase client (server-side only with service role key)
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for RLS bypass
    );

    // Query KYC verification table
    const { data, error } = await supabase
      .from('kyc_verifications')
      .select('*')
      .eq('wallet_address', wallet.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[KYC API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to check KYC status', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        verified: false,
        provider: null,
        created_at: null,
      });
    }

    const verification = data[0];
    return NextResponse.json({
      verified: verification.verified || false,
      provider: verification.provider || 'Didit',
      created_at: verification.created_at,
      workflow_id: verification.workflow_id,
    });
  } catch (error: any) {
    console.error('[KYC API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
