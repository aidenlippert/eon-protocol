/**
 * Protocol Quality Registry
 * Whitelist of trusted DeFi protocols with quality scores
 *
 * Quality Tiers:
 * - Tier 1 (Blue Chip): +5 points - Battle-tested, $1B+ TVL, multiple audits
 * - Tier 2 (Established): +3 points - Proven track record, audited
 * - Tier 3 (Emerging): +1 point - Audited, growing community
 * - Tier 4 (Risky): -2 points - Unaudited or questionable history
 * - Tier 5 (Blacklist): -5 points - Known exploits or rugs
 */

export enum ProtocolTier {
  BLUE_CHIP = 'blue_chip',
  ESTABLISHED = 'established',
  EMERGING = 'emerging',
  RISKY = 'risky',
  BLACKLIST = 'blacklist',
}

export interface ProtocolInfo {
  name: string;
  tier: ProtocolTier;
  category: 'lending' | 'dex' | 'staking' | 'yield' | 'derivatives' | 'bridge' | 'other';
  addresses: {
    [chainId: number]: string[];
  };
  points: number;
  audits: string[];
  launched: Date;
}

/**
 * Protocol Registry - Comprehensive list of known DeFi protocols
 */
export const PROTOCOL_REGISTRY: Record<string, ProtocolInfo> = {
  // ==================== TIER 1: BLUE CHIP ====================
  'aave-v3': {
    name: 'Aave V3',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'lending',
    addresses: {
      1: ['0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'], // Ethereum
      42161: ['0x794a61358D6845594F94dc1DB02A252b5b4814aD'], // Arbitrum
      10: ['0x794a61358D6845594F94dc1DB02A252b5b4814aD'], // Optimism
      8453: ['0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'], // Base
    },
    points: 5,
    audits: ['OpenZeppelin', 'Trail of Bits', 'ABDK', 'Certora'],
    launched: new Date('2022-03-16'),
  },
  'aave-v2': {
    name: 'Aave V2',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'lending',
    addresses: {
      1: ['0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'], // Ethereum
      137: ['0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf'], // Polygon
    },
    points: 5,
    audits: ['OpenZeppelin', 'Trail of Bits', 'Consensys Diligence'],
    launched: new Date('2020-12-03'),
  },
  'compound-v3': {
    name: 'Compound V3',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'lending',
    addresses: {
      1: ['0xc3d688B66703497DAA19211EEdff47f25384cdc3'], // Ethereum USDC
      42161: ['0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA'], // Arbitrum USDC
      8453: ['0x46e6b214b524310239732D51387075E0e70970bf'], // Base USDC
      137: ['0xF25212E676D1F7F89Cd72fFEe66158f541246445'], // Polygon USDC
    },
    points: 5,
    audits: ['OpenZeppelin', 'ChainSecurity', 'Certora'],
    launched: new Date('2022-08-26'),
  },
  'uniswap-v3': {
    name: 'Uniswap V3',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'dex',
    addresses: {
      1: ['0x1F98431c8aD98523631AE4a59f267346ea31F984'], // Factory
      42161: ['0x1F98431c8aD98523631AE4a59f267346ea31F984'],
      10: ['0x1F98431c8aD98523631AE4a59f267346ea31F984'],
      8453: ['0x33128a8fC17869897dcE68Ed026d694621f6FDfD'],
    },
    points: 5,
    audits: ['ABDK', 'Trail of Bits'],
    launched: new Date('2021-05-05'),
  },
  'lido': {
    name: 'Lido',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'staking',
    addresses: {
      1: ['0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'], // stETH
    },
    points: 5,
    audits: ['Sigma Prime', 'Quantstamp', 'MixBytes'],
    launched: new Date('2020-12-18'),
  },
  'curve': {
    name: 'Curve Finance',
    tier: ProtocolTier.BLUE_CHIP,
    category: 'dex',
    addresses: {
      1: ['0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'], // 3pool
      42161: ['0x7544Fe3d184b6B55D6B36c3FCA1157eE0Ba30287'],
      10: ['0x1337BedC9D22ecbe766dF105c9623922A27963EC'],
    },
    points: 5,
    audits: ['Trail of Bits', 'Quantstamp', 'ChainSecurity'],
    launched: new Date('2020-01-10'),
  },

  // ==================== TIER 2: ESTABLISHED ====================
  'balancer': {
    name: 'Balancer',
    tier: ProtocolTier.ESTABLISHED,
    category: 'dex',
    addresses: {
      1: ['0xBA12222222228d8Ba445958a75a0704d566BF2C8'], // Vault
      42161: ['0xBA12222222228d8Ba445958a75a0704d566BF2C8'],
      10: ['0xBA12222222228d8Ba445958a75a0704d566BF2C8'],
    },
    points: 3,
    audits: ['Trail of Bits', 'OpenZeppelin', 'Certora'],
    launched: new Date('2020-03-24'),
  },
  'gmx': {
    name: 'GMX',
    tier: ProtocolTier.ESTABLISHED,
    category: 'derivatives',
    addresses: {
      42161: ['0x489ee077994B6658eAfA855C308275EAd8097C4A'], // Vault
      43114: ['0x489ee077994B6658eAfA855C308275EAd8097C4A'], // Avalanche
    },
    points: 3,
    audits: ['ABDK'],
    launched: new Date('2021-09-01'),
  },
  'stargate': {
    name: 'Stargate Finance',
    tier: ProtocolTier.ESTABLISHED,
    category: 'bridge',
    addresses: {
      1: ['0x8731d54E9D02c286767d56ac03e8037C07e01e98'], // Router
      42161: ['0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614'],
      10: ['0xB0D502E938ed5f4df2E681fE6E419ff29631d62b'],
    },
    points: 3,
    audits: ['Zellic', 'Quantstamp'],
    launched: new Date('2022-03-17'),
  },
  'yearn': {
    name: 'Yearn Finance',
    tier: ProtocolTier.ESTABLISHED,
    category: 'yield',
    addresses: {
      1: ['0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804'], // Registry
    },
    points: 3,
    audits: ['ToB', 'ChainSecurity', 'MixBytes'],
    launched: new Date('2020-02-05'),
  },

  // ==================== TIER 3: EMERGING ====================
  'radiant': {
    name: 'Radiant Capital',
    tier: ProtocolTier.EMERGING,
    category: 'lending',
    addresses: {
      42161: ['0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1'], // Lending Pool
      8453: ['0xA950974f64aA33f27F6C5e017eEE93BF7588ED07'],
    },
    points: 1,
    audits: ['BlockSec', 'Zokyo'],
    launched: new Date('2022-07-26'),
  },
  'synapse': {
    name: 'Synapse Protocol',
    tier: ProtocolTier.EMERGING,
    category: 'bridge',
    addresses: {
      1: ['0x2796317b0fF8538F253012862c06787Adfb8cEb6'], // Bridge
      42161: ['0x6F4e8eBa4D337f874Ab57478AcC2Cb5BACdc19c9'],
    },
    points: 1,
    audits: ['Quantstamp'],
    launched: new Date('2021-08-11'),
  },

  // ==================== TIER 4: RISKY ====================
  'unaudited-farm': {
    name: 'Generic Unaudited Farm',
    tier: ProtocolTier.RISKY,
    category: 'yield',
    addresses: {},
    points: -2,
    audits: [],
    launched: new Date(),
  },

  // ==================== TIER 5: BLACKLIST ====================
  'iron-finance': {
    name: 'Iron Finance (RUGGED)',
    tier: ProtocolTier.BLACKLIST,
    category: 'yield',
    addresses: {
      137: ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'], // Historical
    },
    points: -5,
    audits: [],
    launched: new Date('2021-03-18'),
  },
};

/**
 * Get protocol info by address
 */
export function getProtocolByAddress(
  address: string,
  chainId: number
): ProtocolInfo | null {
  const normalizedAddress = address.toLowerCase();

  for (const protocol of Object.values(PROTOCOL_REGISTRY)) {
    const chainAddresses = protocol.addresses[chainId] || [];
    if (chainAddresses.map(a => a.toLowerCase()).includes(normalizedAddress)) {
      return protocol;
    }
  }

  return null;
}

/**
 * Calculate protocol quality score based on interactions
 */
export function calculateProtocolScore(
  protocolInteractions: { address: string; chainId: number; count: number }[]
): {
  score: number;
  maxScore: number;
  breakdown: {
    protocol: string;
    tier: ProtocolTier;
    points: number;
    interactions: number;
  }[];
} {
  const breakdown: {
    protocol: string;
    tier: ProtocolTier;
    points: number;
    interactions: number;
  }[] = [];

  let totalScore = 0;
  const maxScore = 30; // Maximum points for protocol quality

  for (const interaction of protocolInteractions) {
    const protocol = getProtocolByAddress(interaction.address, interaction.chainId);

    if (protocol) {
      const points = protocol.points;
      totalScore += points;

      breakdown.push({
        protocol: protocol.name,
        tier: protocol.tier,
        points,
        interactions: interaction.count,
      });
    }
  }

  // Normalize to 0-30 range
  const normalizedScore = Math.min(Math.max(totalScore, 0), maxScore);

  return {
    score: normalizedScore,
    maxScore,
    breakdown,
  };
}

/**
 * Get protocol category diversity score
 */
export function calculateCategoryDiversity(
  protocols: ProtocolInfo[]
): number {
  const categories = new Set(protocols.map(p => p.category));

  // Award points for category diversity (max 10 points)
  // 1 category: 2 points
  // 2 categories: 5 points
  // 3 categories: 7 points
  // 4+ categories: 10 points

  const categoryCount = categories.size;

  if (categoryCount >= 4) return 10;
  if (categoryCount === 3) return 7;
  if (categoryCount === 2) return 5;
  if (categoryCount === 1) return 2;
  return 0;
}

/**
 * Check if address is a known risky/blacklisted protocol
 */
export function isBlacklistedProtocol(
  address: string,
  chainId: number
): boolean {
  const protocol = getProtocolByAddress(address, chainId);
  return protocol?.tier === ProtocolTier.BLACKLIST;
}

/**
 * Get all protocols by tier
 */
export function getProtocolsByTier(tier: ProtocolTier): ProtocolInfo[] {
  return Object.values(PROTOCOL_REGISTRY).filter(p => p.tier === tier);
}
