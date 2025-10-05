import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

/**
 * @title Credit Score API Route
 * @notice Backend API for calculating comprehensive credit scores
 * @dev Protects scoring algorithm, enables caching, improves frontend performance
 *
 * **SECURITY**:
 * - Rate limiting (10 requests/minute per IP)
 * - Input validation (address format)
 * - Redis caching (5 minute TTL)
 * - Error handling with sanitized responses
 *
 * **PERFORMANCE**:
 * - Cache hit: ~5ms
 * - Cache miss: ~2-5s (on-chain queries + computation)
 * - 90%+ cache hit rate expected
 */

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const RATE_LIMIT_WINDOW = 60; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

// Initialize Redis client (optional - falls back to in-memory if not available)
let redis: any = null;
try {
  // Only import Redis in production environment
  if (process.env.REDIS_URL) {
    const { createClient } = require('redis');
    redis = createClient({ url: process.env.REDIS_URL });
    redis.connect().catch(console.error);
  }
} catch (error) {
  console.warn('Redis not available, using in-memory cache');
}

// In-memory cache fallback
const memoryCache = new Map<string, { data: any; expiry: number }>();

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * GET /api/score/[address]
 * Calculate comprehensive credit score for an address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;

    // Validate address format
    if (!isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Check cache first
    const cached = await getFromCache(`score:${address.toLowerCase()}`);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate score (cache miss)
    const scoreData = await calculateCreditScore(address);

    // Store in cache
    await setInCache(`score:${address.toLowerCase()}`, scoreData, CACHE_TTL);

    return NextResponse.json({
      ...scoreData,
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Score API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to calculate credit score',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/score/[address]/refresh
 * Force refresh score (bypasses cache)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;

    if (!isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    // Rate limiting (stricter for POST)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp, 5)) { // Max 5 refreshes per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded for refresh requests' },
        { status: 429 }
      );
    }

    // Invalidate cache
    await deleteFromCache(`score:${address.toLowerCase()}`);

    // Calculate fresh score
    const scoreData = await calculateCreditScore(address);

    // Store in cache
    await setInCache(`score:${address.toLowerCase()}`, scoreData, CACHE_TTL);

    return NextResponse.json({
      ...scoreData,
      cached: false,
      refreshed: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Score API] Refresh error:', error);

    return NextResponse.json(
      {
        error: 'Failed to refresh credit score',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ==================== CORE SCORING LOGIC ====================

/**
 * Calculate comprehensive credit score
 * @dev This runs server-side only, protecting the algorithm
 */
async function calculateCreditScore(address: string) {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || arbitrumSepolia.rpcUrls.default.http[0]),
  });

  // Import scoring modules (server-side only)
  const { fetchTransactionHistory } = await import('@/lib/transaction-analyzer');
  const { calculateCreditScore: calcScore } = await import('@/lib/real-credit-score');
  const { applySybilResistance } = await import('@/lib/sybil-resistance');
  const { aggregateCrossChainData } = await import('@/lib/cross-chain-aggregator');

  // Fetch transaction history
  const transactions = await fetchTransactionHistory(address);

  // Calculate base credit score
  const baseScore = await calcScore(address, transactions);

  // Apply sybil resistance
  const sybilData = await applySybilResistance(baseScore, {
    walletAge: calculateWalletAge(transactions),
    proofOfHumanity: await checkProofOfHumanity(address),
    stakingAmount: await getStakingAmount(address),
    linkedWallets: await getLinkedWallets(address),
  });

  // Aggregate cross-chain data (if applicable)
  let crossChainData = null;
  try {
    crossChainData = await aggregateCrossChainData(address);
  } catch (error) {
    console.warn('[Score API] Cross-chain aggregation failed:', error);
  }

  // Map V2 breakdown to legacy format for backward compatibility
  const legacyBreakdown = {
    paymentHistory: {
      score: baseScore.factors.s1_paymentHistory,
      weight: 30,
      evidence: baseScore.breakdown.paymentHistory,
    },
    creditUtilization: {
      score: baseScore.factors.s2_utilization,
      weight: 20,
      evidence: baseScore.breakdown.utilization,
    },
    creditHistoryLength: {
      score: baseScore.factors.s3_accountAge,
      weight: 10,
      evidence: baseScore.breakdown.accountAge,
    },
    creditMix: {
      score: baseScore.factors.s6_deFiMix,
      weight: 10,
      evidence: baseScore.breakdown.deFiMix,
    },
    newCredit: {
      score: baseScore.factors.s7_activityControl,
      weight: 5,
      evidence: baseScore.breakdown.activity,
    },
  };

  return {
    address,
    score: sybilData.finalScore,
    tier: getScoreTier(sybilData.finalScore),
    baseScore: baseScore.score,
    breakdown: legacyBreakdown, // Legacy format
    factors: baseScore.factors, // V2 format (all 7 factors)
    breakdownV2: baseScore.breakdown, // V2 detailed breakdown
    sybilResistance: sybilData,
    crossChain: crossChainData,
    calculatedAt: new Date().toISOString(),
  };
}

// ==================== HELPER FUNCTIONS ====================

function calculateWalletAge(transactions: any[]): number {
  if (transactions.length === 0) return 0;

  const oldestTx = transactions[transactions.length - 1];
  const ageInMs = Date.now() - (oldestTx.timestamp || 0) * 1000;
  return Math.floor(ageInMs / (1000 * 60 * 60 * 24)); // Days
}

async function checkProofOfHumanity(address: string): Promise<any> {
  // TODO: Integrate with Proof of Humanity registry
  // For now, return null
  return null;
}

async function getStakingAmount(address: string): Promise<bigint> {
  // TODO: Query CreditRegistryV3.stakes(address)
  return BigInt(0);
}

async function getLinkedWallets(address: string): Promise<any[]> {
  // TODO: Query Supabase for linked wallets
  return [];
}

function getScoreTier(score: number): string {
  if (score >= 900) return 'Platinum';
  if (score >= 750) return 'Gold';
  if (score >= 600) return 'Silver';
  return 'Bronze';
}

// ==================== CACHE FUNCTIONS ====================

async function getFromCache(key: string): Promise<any | null> {
  try {
    if (redis) {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } else {
      // Fallback to in-memory cache
      const entry = memoryCache.get(key);
      if (entry && entry.expiry > Date.now()) {
        return entry.data;
      } else {
        memoryCache.delete(key);
        return null;
      }
    }
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

async function setInCache(key: string, value: any, ttl: number): Promise<void> {
  try {
    if (redis) {
      await redis.setEx(key, ttl, JSON.stringify(value));
    } else {
      // Fallback to in-memory cache
      memoryCache.set(key, {
        data: value,
        expiry: Date.now() + ttl * 1000,
      });
    }
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
}

async function deleteFromCache(key: string): Promise<void> {
  try {
    if (redis) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

// ==================== RATE LIMITING ====================

function checkRateLimit(identifier: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW * 1000,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  // Increment count
  entry.count++;
  return true;
}

// Cleanup expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Every minute
