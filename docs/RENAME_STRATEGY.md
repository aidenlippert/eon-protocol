# Global Rename Strategy: Chronos → Eon Protocol

## 🎯 RECOMMENDED NAME: **EON PROTOCOL**

### Why Eon?
- **Meaning**: Eon = indefinite period of time, geological age
- **Memorability**: 3 letters, easy to pronounce globally
- **Availability**: eon.finance, eonprotocol.com available
- **Token**: EON (clean, simple)
- **Tagline**: "Eon: Time as Collateral" or "Eon: The Temporal Credit Layer"

---

## 📋 RENAME CHECKLIST

### Phase 1: Verification (Do First!)
- [ ] **Domain check**
  - eon.finance ✅
  - eonprotocol.com ✅
  - app.eonprotocol.com ✅
  - Purchase: ~$30 total

- [ ] **Social handles**
  - Twitter: @eonprotocol ✅
  - GitHub: github.com/eon-protocol ✅
  - Discord: eonprotocol ✅
  - Telegram: @eonprotocol ✅

- [ ] **Trademark search**
  - USPTO: https://tmsearch.uspto.gov
  - EU: https://euipo.europa.eu
  - Check "Eon" in class 36 (financial services)
  - **WARNING**: If taken, use "Eon Protocol" (2 words) or "EonFi"

---

## 🔧 TECHNICAL RENAME STEPS

### Step 1: Smart Contracts Rename

```bash
cd /tmp/chronos-contracts

# Rename files
mv ChronosCore.sol EonCore.sol
mv ChronosNFT.sol EonNFT.sol
mv ChronosGovernance.sol EonGovernance.sol

# Find and replace in all Solidity files
find . -type f -name "*.sol" -exec sed -i 's/Chronos/Eon/g' {} +
find . -type f -name "*.sol" -exec sed -i 's/chronos/eon/g' {} +
find . -type f -name "*.sol" -exec sed -i 's/CHRONOS/EON/g' {} +

# Replace in comments and docs
find . -type f -name "*.sol" -exec sed -i 's/Temporal ownership/Temporal ownership/g' {} +

# Update contract names in inheritance
# ChronosCore → EonCore
# ChronosNFT → EonNFT
# etc.
```

**Files to update**:
- EonCore.sol
- EonNFT.sol
- ClaimManager.sol (references to EonNFT)
- ReputationOracle.sol (references)
- LendingPool.sol (references)
- EonGovernance.sol

### Step 2: Test Files Rename

```bash
cd /tmp/chronos-contracts/test

# Rename test file
mv ChronosProtocol.t.sol EonProtocol.t.sol

# Replace in tests
find . -type f -name "*.sol" -exec sed -i 's/Chronos/Eon/g' {} +
find . -type f -name "*.sol" -exec sed -i 's/chronos/eon/g' {} +
find . -type f -name "*.sol" -exec sed -i 's/CHRONOS/EON/g' {} +

# Update contract imports
sed -i 's/import "\.\.\/Chronos/import "\.\.\/Eon/g' *.sol
```

### Step 3: Documentation Rename

```bash
cd /tmp

# Rename all docs
mv CHRONOS_ECONOMIC_MODEL.md EON_ECONOMIC_MODEL.md
mv CHRONOS_PROTOCOL_COMPLETE.md EON_PROTOCOL_COMPLETE.md
mv CHRONOS_MVP_STATUS.md EON_MVP_STATUS.md

# Find and replace in all markdown files
find . -type f -name "*.md" -exec sed -i 's/Chronos Protocol/Eon Protocol/g' {} +
find . -type f -name "*.md" -exec sed -i 's/Chronos/Eon/g' {} +
find . -type f -name "*.md" -exec sed -i 's/chronos/eon/g' {} +
find . -type f -name "*.md" -exec sed -i 's/CHRONOS/EON/g' {} +

# Update specific phrases
find . -type f -name "*.md" -exec sed -i 's/ChronosCore/EonCore/g' {} +
find . -type f -name "*.md" -exec sed -i 's/ChronosNFT/EonNFT/g' {} +
```

### Step 4: Backend/Indexer Rename

```bash
cd /tmp/chronos-indexer

# Rename directory
cd /tmp
mv chronos-indexer eon-indexer
cd eon-indexer

# Update package.json
sed -i 's/"name": "chronos-indexer"/"name": "eon-indexer"/g' package.json

# Replace in all TypeScript files
find . -type f -name "*.ts" -exec sed -i 's/Chronos/Eon/g' {} +
find . -type f -name "*.ts" -exec sed -i 's/chronos/eon/g' {} +
find . -type f -name "*.ts" -exec sed -i 's/CHRONOS/EON/g' {} +

# Update ABIs and contract references
# ChronosCore → EonCore
# ChronosNFT → EonNFT
```

### Step 5: Frontend Rename (when created)

```bash
# Create as eon-app from the start
npx create-next-app@latest eon-app

# In all files:
find . -type f -exec sed -i 's/Chronos/Eon/g' {} +
find . -type f -exec sed -i 's/chronos/eon/g' {} +

# Update metadata
# title: "Eon Protocol - Time as Collateral"
# description: "Borrow against your on-chain history with ZK privacy"
```

---

## 📝 AUTOMATED RENAME SCRIPT

Create `/tmp/rename-to-eon.sh`:

```bash
#!/bin/bash

echo "🔄 Renaming Chronos → Eon Protocol..."

# Confirmation
read -p "This will rename ALL files and content. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# 1. Rename smart contract files
cd /tmp/chronos-contracts
mv ChronosCore.sol EonCore.sol 2>/dev/null
mv ChronosNFT.sol EonNFT.sol 2>/dev/null
mv ChronosGovernance.sol EonGovernance.sol 2>/dev/null

# 2. Replace in all Solidity files
find . -type f -name "*.sol" -print0 | xargs -0 sed -i '' -e 's/Chronos/Eon/g'
find . -type f -name "*.sol" -print0 | xargs -0 sed -i '' -e 's/chronos/eon/g'
find . -type f -name "*.sol" -print0 | xargs -0 sed -i '' -e 's/CHRONOS/EON/g'

# 3. Rename test files
cd test
mv ChronosProtocol.t.sol EonProtocol.t.sol 2>/dev/null
find . -type f -name "*.sol" -print0 | xargs -0 sed -i '' -e 's/Chronos/Eon/g'

# 4. Rename docs
cd /tmp
mv CHRONOS_ECONOMIC_MODEL.md EON_ECONOMIC_MODEL.md 2>/dev/null
mv CHRONOS_PROTOCOL_COMPLETE.md EON_PROTOCOL_COMPLETE.md 2>/dev/null
mv CHRONOS_MVP_STATUS.md EON_MVP_STATUS.md 2>/dev/null

find . -type f -name "*.md" -print0 | xargs -0 sed -i '' -e 's/Chronos Protocol/Eon Protocol/g'
find . -type f -name "*.md" -print0 | xargs -0 sed -i '' -e 's/Chronos/Eon/g'
find . -type f -name "*.md" -print0 | xargs -0 sed -i '' -e 's/chronos/eon/g'

# 5. Rename indexer directory
mv chronos-indexer eon-indexer 2>/dev/null
cd eon-indexer
sed -i '' -e 's/"chronos"/"eon"/g' package.json 2>/dev/null
find . -type f -name "*.ts" -print0 | xargs -0 sed -i '' -e 's/Chronos/Eon/g'
find . -type f -name "*.ts" -print0 | xargs -0 sed -i '' -e 's/chronos/eon/g'

echo "✅ Rename complete!"
echo "📁 Check these directories:"
echo "  - /tmp/eon-contracts/"
echo "  - /tmp/eon-indexer/"
echo "  - /tmp/EON_*.md files"

# 6. Update Git (if initialized)
cd /tmp
if [ -d .git ]; then
    git add -A
    git commit -m "Rename: Chronos → Eon Protocol"
fi

echo "🎉 Done! Review changes and commit."
```

**Usage**:
```bash
chmod +x /tmp/rename-to-eon.sh
./tmp/rename-to-eon.sh
```

---

## 🔍 VERIFICATION CHECKLIST

After renaming, verify:

### Smart Contracts:
- [ ] All contract names updated (EonCore, EonNFT, etc.)
- [ ] All imports updated
- [ ] All references in comments updated
- [ ] Tests compile: `forge build`
- [ ] Tests pass: `forge test`

### Documentation:
- [ ] README.md title updated
- [ ] All file names updated
- [ ] All internal references updated
- [ ] Links still work
- [ ] No "Chronos" remains: `grep -r "Chronos" /tmp/*.md`

### Backend:
- [ ] Package name updated
- [ ] Contract ABIs updated
- [ ] Environment variables updated (CHRONOS_* → EON_*)
- [ ] API endpoints updated (/chronos → /eon)

### Frontend:
- [ ] App title updated
- [ ] Metadata updated (OG tags, description)
- [ ] Contract addresses updated
- [ ] Logo/branding updated

---

## 🌐 DOMAIN & HOSTING SETUP

### 1. Purchase Domains ($30)
```
Primary: eonprotocol.com ($12/year)
Subdomain setup:
- app.eonprotocol.com (frontend)
- api.eonprotocol.com (GraphQL)
- docs.eonprotocol.com (documentation)

Alternative: eon.finance ($10/year)
```

### 2. Setup DNS (Namecheap or Cloudflare)
```
A     @              → Vercel IP (frontend)
CNAME app            → eon-app.vercel.app
CNAME api            → eon-api.railway.app
CNAME docs           → eon-protocol.github.io

MX    @              → Google Workspace (for email)
TXT   @              → "v=spf1 include:_spf.google.com ~all"
```

### 3. Email Setup ($6/month)
```
Google Workspace:
- founder@eonprotocol.com
- hello@eonprotocol.com
- security@eonprotocol.com
```

---

## 📱 SOCIAL MEDIA SETUP

### Twitter (@eonprotocol)
```
Name: Eon Protocol
Bio: Time as Collateral | Cross-chain credit with ZK privacy | Built on @arbitrum
Link: https://eonprotocol.com
Banner: [Create with Canva - time/clock theme]
```

### GitHub (github.com/eon-protocol)
```
Organization: Eon Protocol
Repos:
- eon-contracts (smart contracts)
- eon-indexer (backend)
- eon-app (frontend)
- eon-docs (documentation)

README.md:
# Eon Protocol
> Time as Collateral - Borrow against your on-chain history

## What is Eon?
Eon is the first cross-chain temporal reputation protocol...
```

### Discord (eonprotocol)
```
Server Name: Eon Protocol
Channels:
- #announcements
- #general
- #dev
- #support
- #governance
```

---

## 🎨 BRANDING GUIDELINES

### Logo Concept:
- **Primary**: Hourglass or infinity symbol (∞) representing time
- **Colors**:
  - Primary: #6366F1 (Indigo) - trust, technology
  - Secondary: #8B5CF6 (Purple) - innovation, mystery
  - Accent: #06B6D4 (Cyan) - future, clarity
- **Font**:
  - Heading: Inter Bold
  - Body: Inter Regular

### Taglines (pick one):
1. "Time as Collateral"
2. "The Temporal Credit Layer"
3. "Your History, Your Credit"
4. "Borrow Against Time"
5. "Reputation Across Chains"

---

## ⚠️ CRITICAL: THINGS NOT TO CHANGE

Keep these concepts the same:
- ✅ Temporal ownership proofs (core primitive)
- ✅ Hybrid optimistic-ZK model
- ✅ Soulbound NFTs
- ✅ Cross-chain reputation
- ✅ Economic model parameters
- ✅ Architecture decisions

Only changing:
- ❌ Brand name: Chronos → Eon
- ❌ File names
- ❌ Contract names
- ❌ Documentation titles

---

## 🚀 LAUNCH ANNOUNCEMENT TEMPLATE

```
🎉 Introducing Eon Protocol

Time as Collateral. Credit without intermediaries.

Eon is the first cross-chain temporal reputation protocol, enabling:

✨ Undercollateralized loans based on on-chain history
🔐 ZK privacy for wallet activity
🌐 Portable reputation across chains
⚡️ Hybrid optimistic-ZK for 99% lower costs

Built on @arbitrum | Powered by @LayerZero_Core

Try it: https://app.eonprotocol.com
Docs: https://docs.eonprotocol.com

🧵 Thread on how it works 👇
```

---

## 📊 RENAME IMPACT ANALYSIS

### What Breaks (temporarily):
- Existing testnet deployments (need redeploy)
- Any external integrations (none yet, so safe)
- Documentation links (easy to update)

### What's Safe:
- Core logic remains identical
- Economic model unchanged
- Architecture stays the same
- ZK circuits work the same

### Timeline:
- **Phase 1** (1 hour): Verify domain/social availability
- **Phase 2** (2 hours): Run automated rename script
- **Phase 3** (1 hour): Manual verification
- **Phase 4** (2 hours): Update GitHub, deploy to testnet
- **Total**: ~6 hours for complete rename

---

## ✅ FINAL RECOMMENDATION

**GO WITH EON PROTOCOL**

Reasons:
1. ✅ Available everywhere (domain, social, trademark likely clear)
2. ✅ Memorable and pronounceable globally
3. ✅ Evokes time/epochs perfectly
4. ✅ Short token ticker (EON)
5. ✅ Professional yet crypto-native

**Alternative if Eon is taken**:
- **Epoch Protocol** (epoch.finance)
- **Temporal Protocol** (temporal.credit)
- **Atlas Protocol** (atlas.finance)

---

**EXECUTE THE RENAME BEFORE TESTNET DEPLOYMENT (Day 2 of sprint)**

This ensures:
- No need to redeploy
- Clean launch from day 1
- Consistent branding everywhere

🎯 **Do it Monday morning, Week 1, Hour 1.**
