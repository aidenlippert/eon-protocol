# EON Protocol Subgraph

The Graph indexer for EON Protocol credit bureau and lending events.

## 🎯 What This Does

Indexes all on-chain events from:
- **CreditRegistryV3**: Loan creation, repayments, liquidations, KYC verifications
- **CreditVaultV3**: Vault operations, grace periods
- **ScoreOraclePhase3B**: Credit score updates

Provides instant GraphQL queries for:
- User loan history
- Credit score evolution
- Protocol statistics
- Liquidation tracking

## 📊 Entities

- `User` - Borrower profiles with aggregated stats
- `Loan` - Individual loan records with full history
- `Repayment` - Repayment transactions
- `ScoreSnapshot` - Credit score over time
- `Liquidation` - Liquidation events
- `ProtocolStats` - Global protocol metrics

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd subgraph
npm install
```

### 2. Copy Contract ABIs
```bash
# Copy from artifacts (after hardhat compile)
cp ../contracts/artifacts/contracts/CreditRegistryV3.sol/CreditRegistryV3.json abis/
cp ../contracts/artifacts/contracts/CreditVaultV3.sol/CreditVaultV3.json abis/
cp ../contracts/artifacts/contracts/ScoreOraclePhase3B.sol/ScoreOraclePhase3B.json abis/
```

### 3. Authenticate with The Graph
```bash
# Get API key from https://thegraph.com/studio/
graph auth --studio <API_KEY>
```

### 4. Generate TypeScript Code
```bash
npm run codegen
```

### 5. Build
```bash
npm run build
```

### 6. Deploy to Subgraph Studio
```bash
npm run deploy
```

## 📝 Example Queries

### Get User Loan History
```graphql
query UserLoans($address: ID!) {
  user(id: $address) {
    id
    totalLoans
    activeLoans
    repaidLoans
    liquidatedLoans
    currentScore
    currentTier
    loans(orderBy: createdAt, orderDirection: desc) {
      id
      principalUsd18
      collateralUsd18
      repaidUsd18
      status
      aprBps
      healthFactor
      createdAt
    }
  }
}
```

### Get Active Loans with Health Factor
```graphql
query ActiveLoans {
  loans(where: {status: Active}, orderBy: healthFactor, orderDirection: asc) {
    id
    borrower {
      id
      currentScore
      currentTier
    }
    principalUsd18
    collateralUsd18
    healthFactor
    graceStart
  }
}
```

### Get Score Evolution
```graphql
query ScoreHistory($address: ID!) {
  user(id: $address) {
    scoreSnapshots(orderBy: timestamp, orderDirection: desc, first: 30) {
      score
      tier
      timestamp
    }
  }
}
```

### Get Protocol Stats
```graphql
query ProtocolStats {
  protocolStats(id: "global") {
    totalUsers
    totalLoans
    activeLoans
    totalBorrowed
    totalRepaid
    averageScore
  }
}
```

## 🔧 Configuration

### Update Contract Addresses
Edit `subgraph.yaml`:
```yaml
dataSources:
  - kind: ethereum
    name: CreditRegistry
    source:
      address: "0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9"
      startBlock: 82000000
```

### Network Support
Current: `arbitrum-sepolia`
Mainnet: Update to `arbitrum-one` when deploying

## 📦 Integration with Frontend

### Install Subgraph Client
```bash
cd ../frontend
npm install @apollo/client graphql
```

### Query from Frontend
```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/eon-protocol/v1',
  cache: new InMemoryCache(),
});

const GET_USER_LOANS = gql`
  query GetUserLoans($address: ID!) {
    user(id: $address) {
      loans {
        id
        principalUsd18
        status
        healthFactor
      }
    }
  }
`;

const { data } = await client.query({
  query: GET_USER_LOANS,
  variables: { address: wallet.toLowerCase() },
});
```

## 🐛 Troubleshooting

### Error: "Failed to compile data source"
- Ensure all ABIs are copied to `abis/` directory
- Run `npm run codegen` before `npm run build`

### Error: "No startBlock specified"
- Update `startBlock` in `subgraph.yaml` to contract deployment block
- Check on Arbiscan for accurate block number

### Slow Indexing
- Subgraph Studio can take 5-10 minutes for initial sync
- Check indexing status at https://thegraph.com/studio/

## 📚 Resources

- [The Graph Docs](https://thegraph.com/docs/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
- [Subgraph Studio](https://thegraph.com/studio/)
