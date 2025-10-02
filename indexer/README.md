# Eon Protocol Indexer

**Temporal Reputation & Credit Scoring Engine**

## What It Does

Validates on-chain credit/reputation claims by:
1. Querying archive nodes for historical balance proofs
2. Calculating reputation scores (0-1000) based on proven holdings
3. Determining dynamic LTV (50-90%) for undercollateralized lending
4. Managing user credit profiles and borrowing power

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Alchemy API key

# Run database migrations
npx prisma migrate dev

# Start indexer
npm run dev
```

## Architecture

### Core Components

**scanner.ts** - Blockchain event monitor
- Listens for ClaimSubmitted events
- Triggers validation for new claims
- Handles claim challenges and finalizations

**validator.ts** - Archive node validator
- Queries historical balances (Alchemy unlimited free tier)
- Samples 52 weekly checkpoints per year
- Builds merkle trees for on-chain verification
- Calculates reputation scores

**credit-engine.ts** - Credit scoring system
- Manages user credit profiles
- Calculates dynamic LTV based on reputation
- Estimates borrowing power
- Makes credit approval decisions

### Reputation Scoring Algorithm

```
Total Score (0-1000) = Duration Score (0-500) + Balance Score (0-500)

Duration:
- 6 months  → 200 points
- 1 year    → 300 points
- 2 years   → 450 points
- 3+ years  → 500 points

Balance (logarithmic):
- 1 ETH     → 100 points
- 10 ETH    → 200 points
- 100 ETH   → 300 points
- 1000+ ETH → 400+ points
```

### LTV Calculation

```
Score → LTV
500   → 50%
700   → 75%
900   → 85%
1000  → 90%
```

## API Examples

### Get Credit Profile

```typescript
import { CreditEngine } from './src/credit-engine';

const engine = new CreditEngine(
  process.env.ALCHEMY_API_KEY!,
  process.env.RPC_URL!
);

const profile = await engine.getCreditProfile('0x742d35Cc...');
console.log(`Score: ${profile.reputationScore}/1000`);
console.log(`LTV: ${profile.ltv}%`);
console.log(`Available Credit: ${profile.availableCredit} ETH`);
```

### Validate Temporal Claim

```typescript
import { TemporalValidator } from './src/validator';

const validator = new TemporalValidator(process.env.ALCHEMY_API_KEY!);

const result = await validator.validateTemporalClaim(
  '0x742d35Cc...',
  ethers.parseEther('10'),  // Held 10 ETH
  18000000,                  // From block 18M
  20500000                   // To block 20.5M
);

if (result.isValid) {
  console.log(`✅ Valid! Score: ${result.reputationScore}/1000`);
}
```

### Check Creditworthiness

```typescript
const decision = await engine.checkCreditworthiness(
  '0x742d35Cc...',
  ethers.parseEther('5')  // Want to borrow 5 ETH
);

if (decision.approved) {
  console.log('✅ Loan approved!');
} else {
  console.log('❌ Denied:', decision.reasons);
}
```

## Database Schema

```prisma
model Claim {
  claimId         String   @id
  user            String
  minBalance      String
  startBlock      Int
  endBlock        Int
  merkleRoot      String
  status          String
  validated       Boolean?
  validationResult Boolean?
}

model Reputation {
  userAddress  String   @id
  score        Int
  ageMonths    Int
  lastClaimId  String
  updatedAt    DateTime
}
```

## How It Works

1. **User submits claim**: "I held 10 ETH for 1 year"
2. **Scanner detects**: ClaimSubmitted event triggers validation
3. **Validator queries**: Archive node checks 52 weekly samples
4. **Score calculated**: Duration + balance → reputation score
5. **Credit updated**: LTV and borrowing power calculated
6. **Lending enabled**: User can borrow based on score

## Testing

```bash
# Run tests
npm test

# Check a specific address
EXAMPLE_ADDRESS=0x... npm run dev
```

## Production Deployment

```bash
# Build
npm run build

# Run in production
npm start
```

## Why Archive Nodes?

Archive nodes store complete historical state, allowing us to prove:
- "This address held X balance at block Y"
- Without expensive on-chain storage
- Using Alchemy's unlimited free tier

## Security

- ✅ Flash loan protection via weekly sampling
- ✅ Economic incentives prevent false claims ($600 stake risk)
- ✅ Merkle proofs enable on-chain verification
- ✅ No sensitive data stored (all public blockchain data)

## Cost Analysis

- **User claim**: ~$3 (optimistic, no ZK needed)
- **Archive queries**: FREE (Alchemy unlimited tier)
- **Indexer operation**: ~$20/month (VPS + database)
- **Challenge resolution**: ~$20-50 (ZK proof, rare)

## Next Steps

1. Deploy ClaimManager contract to Arbitrum testnet
2. Get Alchemy API key
3. Set up PostgreSQL database
4. Run indexer
5. Test with real on-chain data
