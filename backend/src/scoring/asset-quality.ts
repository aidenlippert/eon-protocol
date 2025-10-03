/**
 * Asset Quality Scoring System
 * Categorizes crypto assets by quality/risk profile
 *
 * Quality Tiers:
 * - Tier 1 (Blue Chip): 1.0x weight - ETH, wBTC, major stablecoins
 * - Tier 2 (Established): 0.8x weight - Major L1/L2 tokens, established DeFi
 * - Tier 3 (Mid Cap): 0.6x weight - Proven projects, good liquidity
 * - Tier 4 (Small Cap): 0.3x weight - Newer projects, lower liquidity
 * - Tier 5 (Memecoins/High Risk): 0.1x weight - Highly speculative
 */

export enum AssetTier {
  BLUE_CHIP = 'blue_chip',
  ESTABLISHED = 'established',
  MID_CAP = 'mid_cap',
  SMALL_CAP = 'small_cap',
  HIGH_RISK = 'high_risk',
}

export interface AssetInfo {
  symbol: string;
  name: string;
  tier: AssetTier;
  weight: number;
  category: 'stable' | 'eth' | 'btc' | 'l1' | 'l2' | 'defi' | 'memecoin' | 'other';
  addresses: {
    [chainId: number]: string;
  };
  marketCapRank?: number;
  isStable: boolean;
}

/**
 * Asset Quality Registry
 */
export const ASSET_REGISTRY: Record<string, AssetInfo> = {
  // ==================== TIER 1: BLUE CHIP ====================
  'ETH': {
    symbol: 'ETH',
    name: 'Ethereum',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'eth',
    addresses: {
      1: '0x0000000000000000000000000000000000000000', // Native
      42161: '0x0000000000000000000000000000000000000000',
      10: '0x0000000000000000000000000000000000000000',
      8453: '0x0000000000000000000000000000000000000000',
    },
    marketCapRank: 2,
    isStable: false,
  },
  'WETH': {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'eth',
    addresses: {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      10: '0x4200000000000000000000000000000000000006',
      8453: '0x4200000000000000000000000000000000000006',
    },
    marketCapRank: 2,
    isStable: false,
  },
  'WBTC': {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'btc',
    addresses: {
      1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      42161: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      10: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    },
    marketCapRank: 1,
    isStable: false,
  },
  'USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'stable',
    addresses: {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    },
    marketCapRank: 6,
    isStable: true,
  },
  'USDT': {
    symbol: 'USDT',
    name: 'Tether USD',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'stable',
    addresses: {
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
    marketCapRank: 3,
    isStable: true,
  },
  'DAI': {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    tier: AssetTier.BLUE_CHIP,
    weight: 1.0,
    category: 'stable',
    addresses: {
      1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
    marketCapRank: 13,
    isStable: true,
  },

  // ==================== TIER 2: ESTABLISHED ====================
  'ARB': {
    symbol: 'ARB',
    name: 'Arbitrum',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'l2',
    addresses: {
      42161: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      1: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
    },
    marketCapRank: 40,
    isStable: false,
  },
  'OP': {
    symbol: 'OP',
    name: 'Optimism',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'l2',
    addresses: {
      10: '0x4200000000000000000000000000000000000042',
      1: '0x4200000000000000000000000000000000000042',
    },
    marketCapRank: 50,
    isStable: false,
  },
  'LINK': {
    symbol: 'LINK',
    name: 'Chainlink',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'defi',
    addresses: {
      1: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      42161: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      10: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
    },
    marketCapRank: 15,
    isStable: false,
  },
  'UNI': {
    symbol: 'UNI',
    name: 'Uniswap',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'defi',
    addresses: {
      1: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      42161: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
      10: '0x6fd9d7AD17242c41f7131d257212c54A0e816691',
    },
    marketCapRank: 20,
    isStable: false,
  },
  'AAVE': {
    symbol: 'AAVE',
    name: 'Aave',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'defi',
    addresses: {
      1: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      42161: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196',
      10: '0x76FB31fb4af56892A25e32cFC43De717950c9278',
    },
    marketCapRank: 45,
    isStable: false,
  },
  'MATIC': {
    symbol: 'MATIC',
    name: 'Polygon',
    tier: AssetTier.ESTABLISHED,
    weight: 0.8,
    category: 'l1',
    addresses: {
      1: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
      137: '0x0000000000000000000000000000000000001010',
    },
    marketCapRank: 30,
    isStable: false,
  },

  // ==================== TIER 3: MID CAP ====================
  'CRV': {
    symbol: 'CRV',
    name: 'Curve DAO Token',
    tier: AssetTier.MID_CAP,
    weight: 0.6,
    category: 'defi',
    addresses: {
      1: '0xD533a949740bb3306d119CC777fa900bA034cd52',
      42161: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978',
    },
    marketCapRank: 80,
    isStable: false,
  },
  'GMX': {
    symbol: 'GMX',
    name: 'GMX',
    tier: AssetTier.MID_CAP,
    weight: 0.6,
    category: 'defi',
    addresses: {
      42161: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
      43114: '0x62edc0692BD897D2295872a9FFCac5425011c661',
    },
    marketCapRank: 100,
    isStable: false,
  },
  'RDNT': {
    symbol: 'RDNT',
    name: 'Radiant Capital',
    tier: AssetTier.MID_CAP,
    weight: 0.6,
    category: 'defi',
    addresses: {
      42161: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    },
    marketCapRank: 200,
    isStable: false,
  },

  // ==================== TIER 4: SMALL CAP ====================
  'JONES': {
    symbol: 'JONES',
    name: 'Jones DAO',
    tier: AssetTier.SMALL_CAP,
    weight: 0.3,
    category: 'defi',
    addresses: {
      42161: '0x10393c20975cF177a3513071bC110f7962CD67da',
    },
    marketCapRank: 500,
    isStable: false,
  },

  // ==================== TIER 5: HIGH RISK / MEMECOINS ====================
  'PEPE': {
    symbol: 'PEPE',
    name: 'Pepe',
    tier: AssetTier.HIGH_RISK,
    weight: 0.1,
    category: 'memecoin',
    addresses: {
      1: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    },
    marketCapRank: 25,
    isStable: false,
  },
  'SHIB': {
    symbol: 'SHIB',
    name: 'Shiba Inu',
    tier: AssetTier.HIGH_RISK,
    weight: 0.1,
    category: 'memecoin',
    addresses: {
      1: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    },
    marketCapRank: 18,
    isStable: false,
  },
};

/**
 * Get asset info by address
 */
export function getAssetByAddress(
  address: string,
  chainId: number
): AssetInfo | null {
  const normalizedAddress = address.toLowerCase();

  // Handle native ETH
  if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
    return ASSET_REGISTRY['ETH'];
  }

  for (const asset of Object.values(ASSET_REGISTRY)) {
    const assetAddress = asset.addresses[chainId];
    if (assetAddress && assetAddress.toLowerCase() === normalizedAddress) {
      return asset;
    }
  }

  return null;
}

/**
 * Calculate asset quality score
 */
export function calculateAssetQualityScore(
  holdings: { address: string; chainId: number; valueUSD: number }[]
): {
  weightedScore: number;
  totalValue: number;
  breakdown: {
    asset: string;
    tier: AssetTier;
    weight: number;
    valueUSD: number;
    contribution: number;
  }[];
} {
  let totalWeightedValue = 0;
  let totalValue = 0;

  const breakdown: {
    asset: string;
    tier: AssetTier;
    weight: number;
    valueUSD: number;
    contribution: number;
  }[] = [];

  for (const holding of holdings) {
    const asset = getAssetByAddress(holding.address, holding.chainId);

    if (asset) {
      const weightedValue = holding.valueUSD * asset.weight;
      totalWeightedValue += weightedValue;
      totalValue += holding.valueUSD;

      breakdown.push({
        asset: asset.symbol,
        tier: asset.tier,
        weight: asset.weight,
        valueUSD: holding.valueUSD,
        contribution: weightedValue,
      });
    } else {
      // Unknown asset - treat as high risk (0.1x weight)
      const weightedValue = holding.valueUSD * 0.1;
      totalWeightedValue += weightedValue;
      totalValue += holding.valueUSD;

      breakdown.push({
        asset: holding.address.slice(0, 8),
        tier: AssetTier.HIGH_RISK,
        weight: 0.1,
        valueUSD: holding.valueUSD,
        contribution: weightedValue,
      });
    }
  }

  // Calculate quality ratio (0-100)
  // 100 = all blue chip assets, 0 = all memecoins
  const qualityRatio = totalValue > 0 ? (totalWeightedValue / totalValue) * 100 : 0;

  return {
    weightedScore: Math.round(qualityRatio * 10) / 10,
    totalValue,
    breakdown,
  };
}

/**
 * Get asset diversity score
 */
export function calculateAssetDiversity(assets: AssetInfo[]): number {
  const categories = new Set(assets.map(a => a.category));

  // Award points for category diversity (max 10 points)
  const categoryCount = categories.size;

  if (categoryCount >= 5) return 10;
  if (categoryCount === 4) return 8;
  if (categoryCount === 3) return 6;
  if (categoryCount === 2) return 4;
  if (categoryCount === 1) return 2;
  return 0;
}

/**
 * Check if asset is stablecoin
 */
export function isStablecoin(address: string, chainId: number): boolean {
  const asset = getAssetByAddress(address, chainId);
  return asset?.isStable || false;
}

/**
 * Get collateral quality multiplier
 * Used for adjusting credit utilization calculations
 */
export function getCollateralQualityMultiplier(
  address: string,
  chainId: number
): number {
  const asset = getAssetByAddress(address, chainId);
  return asset?.weight || 0.1; // Default to high risk if unknown
}
