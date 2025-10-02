# Chronos Indexer Network

Decentralized indexer network for auto-challenging invalid temporal ownership claims.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Indexer Network                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Indexer 1  │  │   Indexer 2  │  │   Indexer N  │      │
│  │              │  │              │  │              │      │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │      │
│  │ │ Scanner  │ │  │ │ Scanner  │ │  │ │ Scanner  │ │      │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │      │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │      │
│  │ │Validator │ │  │ │Validator │ │  │ │Validator │ │      │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │      │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │      │
│  │ │Challenger│ │  │ │Challenger│ │  │ │Challenger│ │      │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                          │                                  │
│                  ┌───────▼────────┐                         │
│                  │  GraphQL API   │                         │
│                  └───────┬────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Frontend   │
                    └──────────────┘
```

## Components

### 1. Blockchain Scanner
- **Purpose**: Monitor ClaimManager contract for new claims
- **Technology**: ethers.js v6 with WebSocket provider
- **Features**:
  - Event listening: `ClaimSubmitted`, `ClaimChallenged`, `ClaimFinalized`
  - Block reorganization handling
  - Checkpoint persistence

### 2. Claim Validator
- **Purpose**: Verify temporal ownership claims against historical data
- **Technology**: Archive node queries (Alchemy, Infura)
- **Algorithm**:
  ```
  For each claim:
    1. Parse merkle root and balance requirement
    2. Query archive node for balance at each sample block
    3. Verify balance ≥ minBalance for all samples
    4. Calculate fraud probability
    5. If fraud detected → trigger challenge
  ```

### 3. Auto-Challenger
- **Purpose**: Submit challenges for invalid claims
- **Technology**: ethers.js Contract interaction
- **Economic Model**:
  - Challenge stake: 0.2 ETH
  - Expected profit: 0.1 ETH (user's stake) - gas costs
  - Success rate: 99.9% (from economic model)

### 4. GraphQL API
- **Purpose**: Expose indexed data to frontend
- **Technology**: Apollo Server + PostgreSQL
- **Schema**:
  ```graphql
  type Claim {
    id: ID!
    user: String!
    minBalance: String!
    startBlock: Int!
    endBlock: Int!
    status: ClaimStatus!
    challengedBy: String
    createdAt: Int!
  }

  type Query {
    claim(id: ID!): Claim
    claims(status: ClaimStatus): [Claim!]!
    userClaims(user: String!): [Claim!]!
    userReputation(user: String!): Reputation
  }

  type Reputation {
    score: Int!
    ageMonths: Int!
    isSlashed: Boolean!
  }
  ```

## Implementation Plan

### Phase 1: Core Indexer (Week 1-2)
- [ ] Setup Rust/Go project structure
- [ ] Implement blockchain scanner with event listeners
- [ ] Add PostgreSQL database schema
- [ ] Build claim validator logic
- [ ] Unit tests for validation algorithm

### Phase 2: Auto-Challenger (Week 3)
- [ ] Implement challenge submission logic
- [ ] Add economic profitability checks
- [ ] Build retry mechanisms for failed transactions
- [ ] Integration tests with testnet

### Phase 3: GraphQL API (Week 4)
- [ ] Setup Apollo Server
- [ ] Implement resolvers for claims and reputation
- [ ] Add WebSocket subscriptions for real-time updates
- [ ] API documentation

### Phase 4: Decentralization (Week 5-6)
- [ ] Multi-indexer consensus mechanism
- [ ] Staking contract for indexer registration
- [ ] Slashing for dishonest indexers
- [ ] P2P network for indexer coordination

### Phase 5: Production (Week 7-8)
- [ ] Monitoring and alerting (Grafana)
- [ ] Load testing and optimization
- [ ] Security audit
- [ ] Mainnet deployment

## Economic Model

**Indexer Revenue Sources**:
1. **Challenge Rewards**: 0.1 ETH per successful challenge
2. **Indexing Fees**: 0.1% of borrow amounts (paid by protocol)
3. **Staking Rewards**: 5% APR on staked tokens

**Monthly Projections** (from economic model):
- Valid challenges: 10/month
- Challenge profit: 10 × $150 = $1,500
- Indexing fees: 2% of $1.5M TVL = $30,000/year = $2,500/month
- **Total**: ~$3,000/month per indexer

**Operating Costs**:
- Archive node: $500/month (Alchemy Growth plan)
- Server hosting: $200/month (AWS t3.large)
- Gas costs: $200/month (10 challenges × $20)
- **Net profit**: $2,100/month

## Technology Stack

### Backend
- **Language**: Rust (performance) or Go (ease of development)
- **Framework**: Tokio (async runtime for Rust) or Gin (Go)
- **Database**: PostgreSQL 15 with TimescaleDB
- **Blockchain**: ethers-rs (Rust) or go-ethereum
- **Cache**: Redis for hot data

### GraphQL API
- **Server**: Apollo Server (Node.js) or gqlgen (Go)
- **ORM**: Prisma (Node.js) or sqlx (Rust/Go)
- **Real-time**: GraphQL subscriptions over WebSocket

### Infrastructure
- **Container**: Docker + docker-compose
- **Orchestration**: Kubernetes (production)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK stack (Elasticsearch, Logstash, Kibana)

## Running Locally

```bash
# Clone repository
git clone https://github.com/chronos-protocol/indexer
cd chronos-indexer

# Setup environment
cp .env.example .env
# Edit .env with your RPC URLs and private keys

# Start database
docker-compose up -d postgres redis

# Run migrations
npm run migrate

# Start indexer
npm run start:indexer

# Start API server
npm run start:api
```

## Configuration

```yaml
# config.yaml
network:
  rpc_url: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
  ws_url: "wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
  chain_id: 1
  archive_node: true

contracts:
  claim_manager: "0x..."
  reputation_oracle: "0x..."
  lending_pool: "0x..."

indexer:
  start_block: 18000000
  batch_size: 1000
  checkpoint_interval: 100

challenger:
  enabled: true
  min_profit: 0.05  # ETH
  max_gas_price: 100  # gwei
  private_key: "0x..."

database:
  host: "localhost"
  port: 5432
  name: "chronos"
  user: "indexer"

api:
  port: 4000
  cors_origins: ["http://localhost:3000"]
```

## Security Considerations

1. **Private Key Management**: Use AWS KMS or Vault
2. **Rate Limiting**: Prevent API abuse
3. **Archive Node Access**: Protect RPC endpoints
4. **Database Security**: Encrypted at rest, SSL connections
5. **DDoS Protection**: Cloudflare or AWS Shield

## Monitoring

Key metrics to track:
- Claims processed per hour
- Validation accuracy rate
- Challenge success rate
- API response times
- Database query performance
- Indexer uptime
- Gas costs per challenge

## Decentralization Strategy

### Indexer Registration
```solidity
contract IndexerRegistry {
    mapping(address => Indexer) public indexers;

    struct Indexer {
        uint256 stake;  // 10 ETH minimum
        uint256 reputation;
        uint256 successfulChallenges;
        uint256 failedChallenges;
        bool active;
    }

    function registerIndexer() external payable {
        require(msg.value >= 10 ether, "Insufficient stake");
        indexers[msg.sender] = Indexer({
            stake: msg.value,
            reputation: 100,
            successfulChallenges: 0,
            failedChallenges: 0,
            active: true
        });
    }
}
```

### Consensus Mechanism
- **Challenge Voting**: 3+ indexers must agree before challenge
- **Slashing**: Indexers lose 1 ETH for false challenges
- **Rewards**: Split among indexers who validated correctly

## Next Steps

1. Choose implementation language (Rust recommended for performance)
2. Setup development environment
3. Implement blockchain scanner
4. Build claim validation logic
5. Deploy to testnet
6. Beta testing with real users
