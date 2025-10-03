/**
 * DAO Participation Tracker
 * Monitors governance participation across major DAOs
 *
 * Data Sources:
 * - Snapshot GraphQL API (off-chain voting)
 * - Tally API (on-chain governance)
 * - Direct on-chain governor contract queries
 *
 * Scoring Impact:
 * - 0 votes: 0 points (no participation)
 * - 1-4 votes: +1 point (minimal engagement)
 * - 5-9 votes: +2 points (active participant)
 * - 10-19 votes: +3 points (very active)
 * - 20+ votes: +4 points (governance power user)
 */

import type { Address } from 'viem';

export interface DAOVote {
  dao: string;
  proposalId: string;
  proposalTitle: string;
  choice: string;
  votedAt: Date;
  votingPower: string;
  platform: 'snapshot' | 'tally' | 'onchain';
}

export interface DAOParticipation {
  totalVotes: number;
  daos: string[];
  recentVotes: number; // Last 6 months
  votes: DAOVote[];
}

/**
 * Snapshot GraphQL endpoint
 */
const SNAPSHOT_API = 'https://hub.snapshot.org/graphql';

/**
 * Tally API endpoint
 */
const TALLY_API = 'https://api.tally.xyz/query';

/**
 * Major DAOs to track (Snapshot space IDs)
 */
const MAJOR_DAOS = {
  snapshot: [
    'aave.eth', // Aave
    'uniswapgovernance.eth', // Uniswap
    'arbitrumfoundation.eth', // Arbitrum
    'opcollective.eth', // Optimism
    'ens.eth', // ENS
    'gitcoindao.eth', // Gitcoin
    'safe.eth', // Safe
    'balancer.eth', // Balancer
    'curve.eth', // Curve
    'compoundgrants.eth', // Compound
    'stgdao.eth', // Stargate
    'lido-snapshot.eth', // Lido
  ],
  tally: [
    'eip155:1:0x7Ae109A63ff4DC852e063a673b40BED85D22E585', // Arbitrum Governor
    'eip155:1:0xcDF27F107725988f2261Ce2256bDfCdE8B382B10', // Compound Governor Bravo
    'eip155:1:0x408ED6354d4973f66138C91495F2f2FCbd8724C3', // Uniswap Governor
    'eip155:10:0xcDF27F107725988f2261Ce2256bDfCdE8B382B10', // Optimism Governor
  ],
};

/**
 * Fetch DAO participation from Snapshot
 */
async function fetchSnapshotVotes(voterAddress: Address): Promise<DAOVote[]> {
  const query = `
    query Votes($voter: String!) {
      votes(
        first: 1000
        where: {
          voter: $voter
          space_in: ${JSON.stringify(MAJOR_DAOS.snapshot)}
        }
        orderBy: "created"
        orderDirection: desc
      ) {
        id
        voter
        created
        choice
        space {
          id
          name
        }
        proposal {
          id
          title
        }
      }
    }
  `;

  try {
    const response = await fetch(SNAPSHOT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          voter: voterAddress.toLowerCase(),
        },
      }),
    });

    const data = await response.json();

    if (!data.data?.votes) {
      return [];
    }

    return data.data.votes.map((vote: any) => ({
      dao: vote.space.name || vote.space.id,
      proposalId: vote.proposal.id,
      proposalTitle: vote.proposal.title,
      choice: formatChoice(vote.choice),
      votedAt: new Date(vote.created * 1000),
      votingPower: 'unknown', // Snapshot doesn't return voting power in this query
      platform: 'snapshot' as const,
    }));
  } catch (error) {
    console.error('Error fetching Snapshot votes:', error);
    return [];
  }
}

/**
 * Fetch DAO participation from Tally
 */
async function fetchTallyVotes(voterAddress: Address): Promise<DAOVote[]> {
  const query = `
    query Votes($voter: Address!) {
      votes(
        input: {
          filters: {
            voter: $voter
            governorIds: ${JSON.stringify(MAJOR_DAOS.tally)}
          }
          page: { limit: 100 }
        }
      ) {
        nodes {
          id
          support
          weight
          createdAt
          proposal {
            id
            title
            governor {
              name
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(TALLY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.TALLY_API_KEY || '', // Optional: better rate limits with API key
      },
      body: JSON.stringify({
        query,
        variables: {
          voter: voterAddress,
        },
      }),
    });

    const data = await response.json();

    if (!data.data?.votes?.nodes) {
      return [];
    }

    return data.data.votes.nodes.map((vote: any) => ({
      dao: vote.proposal.governor.name,
      proposalId: vote.proposal.id,
      proposalTitle: vote.proposal.title,
      choice: formatTallySupport(vote.support),
      votedAt: new Date(vote.createdAt),
      votingPower: vote.weight,
      platform: 'tally' as const,
    }));
  } catch (error) {
    console.error('Error fetching Tally votes:', error);
    return [];
  }
}

/**
 * Fetch all DAO participation for a user
 */
export async function fetchDAOParticipation(
  userAddress: Address
): Promise<DAOParticipation> {
  // Fetch from both platforms in parallel
  const [snapshotVotes, tallyVotes] = await Promise.all([
    fetchSnapshotVotes(userAddress),
    fetchTallyVotes(userAddress),
  ]);

  const allVotes = [...snapshotVotes, ...tallyVotes];

  // Sort by date (most recent first)
  allVotes.sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime());

  // Get unique DAOs
  const daos = [...new Set(allVotes.map((v) => v.dao))];

  // Count recent votes (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentVotes = allVotes.filter((v) => v.votedAt >= sixMonthsAgo).length;

  return {
    totalVotes: allVotes.length,
    daos,
    recentVotes,
    votes: allVotes,
  };
}

/**
 * Calculate DAO participation score (0-4 points max)
 */
export function calculateDAOScore(
  participation: DAOParticipation
): {
  score: number;
  maxScore: number;
  evidence: {
    totalVotes: number;
    recentVotes: number;
    daosParticipated: number;
    topDAOs: string[];
  };
} {
  const maxScore = 4;
  const { totalVotes, daos, recentVotes } = participation;

  // Calculate base score from total votes
  let score = 0;

  if (totalVotes === 0) {
    score = 0;
  } else if (totalVotes < 5) {
    score = 1;
  } else if (totalVotes < 10) {
    score = 2;
  } else if (totalVotes < 20) {
    score = 3;
  } else {
    score = 4;
  }

  // Bonus for recent activity (+0.5 if voted in last 6 months)
  if (recentVotes > 0 && score < maxScore) {
    score += 0.5;
  }

  // Bonus for participating in multiple DAOs (+0.5 if 3+ DAOs)
  if (daos.length >= 3 && score < maxScore) {
    score += 0.5;
  }

  // Get top 5 DAOs by vote count
  const daoVoteCounts = participation.votes.reduce((acc, vote) => {
    acc[vote.dao] = (acc[vote.dao] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topDAOs = Object.entries(daoVoteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  return {
    score: Math.min(maxScore, Math.round(score * 10) / 10),
    maxScore,
    evidence: {
      totalVotes,
      recentVotes,
      daosParticipated: daos.length,
      topDAOs,
    },
  };
}

/**
 * Format Snapshot choice (can be number or array)
 */
function formatChoice(choice: any): string {
  if (typeof choice === 'number') {
    return `Option ${choice}`;
  }

  if (Array.isArray(choice)) {
    return `Multiple choices`;
  }

  return String(choice);
}

/**
 * Format Tally support type
 */
function formatTallySupport(support: string): string {
  const supportMap: Record<string, string> = {
    FOR: 'For',
    AGAINST: 'Against',
    ABSTAIN: 'Abstain',
  };

  return supportMap[support] || support;
}

/**
 * Check if user is active in governance (voted in last 90 days)
 */
export function isActiveGovernanceParticipant(
  participation: DAOParticipation
): boolean {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return participation.votes.some((v) => v.votedAt >= ninetyDaysAgo);
}

/**
 * Get governance participation tier
 */
export function getGovernanceTier(totalVotes: number): string {
  if (totalVotes >= 20) return 'Power User';
  if (totalVotes >= 10) return 'Very Active';
  if (totalVotes >= 5) return 'Active';
  if (totalVotes >= 1) return 'Participant';
  return 'Not Participating';
}

/**
 * Calculate governance consistency score (votes per month active)
 */
export function getGovernanceConsistency(
  participation: DAOParticipation
): number {
  if (participation.votes.length === 0) return 0;

  const oldest = participation.votes[participation.votes.length - 1].votedAt;
  const newest = participation.votes[0].votedAt;

  const monthsActive =
    (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsActive < 1) return participation.votes.length;

  return participation.votes.length / monthsActive;
}
