import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, isAddress, parseAbi } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * @title EAS Attestation API Route
 * @notice Server-side endpoint for creating credit score attestations
 * @dev Uses ScoreAttestor contract to create immutable on-chain attestations
 *
 * **Security**:
 * - Server-side only (private key never exposed to client)
 * - Rate limiting (5 attestations/hour per wallet)
 * - Score validation (0-1000 range)
 * - Wallet verification
 *
 * **Contracts**:
 * - ScoreAttestor: 0xECb3AD5B42F59f3E6D688cA48525472aE458B3EB
 * - EAS: 0xaEF4103A04090071165F78D45D83A0C0782c2B2a
 */

// Contract addresses
const ATTESTOR_ADDRESS = process.env.ATTESTOR_ADDRESS || '0xECb3AD5B42F59f3E6D688cA48525472aE458B3EB';

// Rate limiting store
const attestationRateLimit = new Map<string, { count: number; resetAt: number }>();

// ScoreAttestor ABI (minimal for attestScore)
const ATTESTOR_ABI = parseAbi([
  'function attestScore(address user, uint256 score, string tier) external returns (bytes32)',
  'function getLatestAttestation(address user) external view returns (bytes32)',
  'function verifyAttestation(bytes32 uid) external view returns (bool)',
  'function decodeAttestation(bytes32 uid) external view returns (address user, uint256 score, string tier, uint256 timestamp)',
]);

/**
 * POST /api/attest
 * Create attestation for user's credit score
 *
 * @body wallet - User's wallet address
 * @body score - Credit score (0-1000)
 * @body tier - Credit tier (Bronze/Silver/Gold/Platinum)
 */
export async function POST(request: NextRequest) {
  try {
    const { wallet, score, tier } = await request.json();

    // ==================== VALIDATION ====================

    // Validate wallet address
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Validate score
    if (typeof score !== 'number' || score < 0 || score > 1000) {
      return NextResponse.json(
        { error: 'Invalid score (must be 0-1000)' },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    if (!tier || !validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier (must be ${validTiers.join(', ')})` },
        { status: 400 }
      );
    }

    // Rate limiting (5 attestations per hour per wallet)
    if (!checkAttestationRateLimit(wallet, 5)) {
      return NextResponse.json(
        { error: 'Attestation rate limit exceeded (max 5/hour)' },
        { status: 429 }
      );
    }

    // ==================== BLOCKCHAIN INTERACTION ====================

    // Create clients
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || arbitrumSepolia.rpcUrls.default.http[0]),
    });

    // Server-side wallet (requires ATTESTOR_PRIVATE_KEY in .env)
    if (!process.env.ATTESTOR_PRIVATE_KEY) {
      console.error('[Attest API] Missing ATTESTOR_PRIVATE_KEY in environment');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    const account = privateKeyToAccount(process.env.ATTESTOR_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || arbitrumSepolia.rpcUrls.default.http[0]),
    });

    // Call attestScore() on ScoreAttestor contract
    console.log('[Attest API] Creating attestation:', { wallet, score, tier });

    const hash = await walletClient.writeContract({
      address: ATTESTOR_ADDRESS as `0x${string}`,
      abi: ATTESTOR_ABI,
      functionName: 'attestScore',
      args: [wallet as `0x${string}`, BigInt(score), tier],
    });

    console.log('[Attest API] Transaction hash:', hash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Attestation transaction failed' },
        { status: 500 }
      );
    }

    // Extract attestation UID from event logs
    // AttestationCreated(address indexed user, bytes32 indexed uid, uint256 score, string tier, uint256 timestamp)
    let attestationUID: string | null = null;
    for (const log of receipt.logs) {
      if (log.topics.length >= 2) {
        attestationUID = log.topics[1]; // UID is second indexed parameter
        break;
      }
    }

    console.log('[Attest API] Attestation created:', attestationUID);

    // ==================== RESPONSE ====================

    return NextResponse.json({
      success: true,
      attestationUID,
      transactionHash: hash,
      explorer: `https://sepolia.arbiscan.io/tx/${hash}`,
      easExplorer: attestationUID
        ? `https://arbitrum-sepolia.easscan.org/attestation/view/${attestationUID}`
        : null,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Attest API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create attestation',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/attest?wallet=0x...
 * Get latest attestation for wallet
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Create client
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || arbitrumSepolia.rpcUrls.default.http[0]),
    });

    // Get latest attestation UID
    const attestationUID = await publicClient.readContract({
      address: ATTESTOR_ADDRESS as `0x${string}`,
      abi: ATTESTOR_ABI,
      functionName: 'getLatestAttestation',
      args: [wallet as `0x${string}`],
    }) as `0x${string}`;

    // If no attestation, return null
    if (attestationUID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return NextResponse.json({
        hasAttestation: false,
        attestationUID: null,
      });
    }

    // Verify attestation
    const isValid = await publicClient.readContract({
      address: ATTESTOR_ADDRESS as `0x${string}`,
      abi: ATTESTOR_ABI,
      functionName: 'verifyAttestation',
      args: [attestationUID],
    }) as boolean;

    // Decode attestation data
    const [user, score, tier, timestamp] = await publicClient.readContract({
      address: ATTESTOR_ADDRESS as `0x${string}`,
      abi: ATTESTOR_ABI,
      functionName: 'decodeAttestation',
      args: [attestationUID],
    }) as [string, bigint, string, bigint];

    return NextResponse.json({
      hasAttestation: true,
      attestationUID,
      isValid,
      data: {
        user,
        score: Number(score),
        tier,
        timestamp: Number(timestamp),
      },
      easExplorer: `https://arbitrum-sepolia.easscan.org/attestation/view/${attestationUID}`,
    });

  } catch (error: any) {
    console.error('[Attest API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch attestation',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ==================== RATE LIMITING ====================

function checkAttestationRateLimit(wallet: string, maxPerHour: number): boolean {
  const now = Date.now();
  const entry = attestationRateLimit.get(wallet.toLowerCase());

  if (!entry || entry.resetAt < now) {
    // New hour window
    attestationRateLimit.set(wallet.toLowerCase(), {
      count: 1,
      resetAt: now + 3600000, // 1 hour
    });
    return true;
  }

  if (entry.count >= maxPerHour) {
    return false; // Rate limit exceeded
  }

  // Increment count
  entry.count++;
  return true;
}

// Cleanup expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [wallet, entry] of attestationRateLimit.entries()) {
    if (entry.resetAt < now) {
      attestationRateLimit.delete(wallet);
    }
  }
}, 300000); // Every 5 minutes
