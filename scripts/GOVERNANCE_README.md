# 🔐 EON Protocol Governance & Upgrade Scripts

Production-grade security and upgrade management for EON Protocol contracts.

## 📋 Table of Contents
- [Gnosis Safe Setup](#gnosis-safe-setup)
- [Contract Upgrades](#contract-upgrades)
- [Ownership Transfer](#ownership-transfer)
- [Security Best Practices](#security-best-practices)

---

## 🛡️ Gnosis Safe Setup

### Deploy Multi-Sig Wallet

```bash
npx hardhat run scripts/deploy-gnosis-safe.ts --network arbitrumSepolia
```

**What it does**:
- Deploys Gnosis Safe with 3 owners
- Requires 2 of 3 signatures (configurable)
- Saves config to `gnosis-safe-config.json`

**Configuration**:
```typescript
const owners = [
  '0xOwner1...', // Replace with actual addresses
  '0xOwner2...',
  '0xOwner3...',
];
const threshold = 2; // 2 of 3 required
```

**Output**:
```json
{
  "safeAddress": "0x...",
  "owners": [...],
  "threshold": 2,
  "deployedAt": "2025-01-05T..."
}
```

---

## 🔄 Contract Upgrades

### Upgrade All Contracts (UUPS Pattern)

```bash
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/upgrade-contracts.ts --network arbitrumSepolia
```

**What it upgrades**:
- ✅ CreditRegistryV3 → V4
- ✅ ScoreOraclePhase3B → V4
- ✅ CreditVaultV3 → V4

**IMPORTANT**: Edit script to change contract versions:
```typescript
// Change from V3 to V4 when ready
const CreditRegistryV4 = await ethers.getContractFactory('CreditRegistryV4');
```

**Output**:
- New implementation addresses
- Upgrade info saved to `upgrade-{timestamp}.json`
- Proxy addresses remain unchanged ✅

### Pre-Upgrade Checklist

- [ ] Audit new contract code
- [ ] Run all tests: `npm test`
- [ ] Deploy to testnet first
- [ ] Verify storage layout compatibility
- [ ] Test upgrade on fork
- [ ] Prepare rollback plan
- [ ] Notify users of upcoming upgrade

---

## 🔐 Ownership Transfer

### Transfer to Gnosis Safe

```bash
npx hardhat run scripts/transfer-ownership.ts --network arbitrumSepolia
```

**What it does**:
- Reads Safe address from `gnosis-safe-config.json`
- Transfers ownership of all 3 contracts
- Only Safe owners can execute admin functions

**Contracts Transferred**:
1. CreditRegistryV3 (0x425d4DBD...)
2. ScoreOraclePhase3B (0x3460891E...)
3. CreditVaultV3 (0x52F65D2A...)

**After Transfer**:
- All `onlyOwner` functions require Safe signatures
- Upgrades require multi-sig approval
- Pause/unpause requires multi-sig approval

---

## 🏗️ Upgrade Process (Step-by-Step)

### 1. Pre-Deployment

```bash
# Compile new contracts
npm run compile

# Run tests
npm test

# Deploy to testnet fork
npx hardhat node --fork https://arb-sepolia.g.alchemy.com/v2/...
```

### 2. Deployment

```bash
# Deploy new implementation (via Safe if ownership transferred)
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/upgrade-contracts.ts --network arbitrumSepolia
```

### 3. Verification

```bash
# Verify new implementation on Arbiscan
npx hardhat verify --network arbitrumSepolia <NEW_IMPL_ADDRESS>

# Test upgraded contracts
npx hardhat run scripts/test-upgrade.ts --network arbitrumSepolia
```

### 4. User Communication

- Announce upgrade 24 hours in advance
- Explain new features/fixes
- Provide rollback plan
- Monitor for issues

---

## 🔒 Security Best Practices

### Multi-Sig Configuration

**Recommended Setup (Production)**:
- **3-5 owners**: Core team members
- **Threshold**: 60-70% (e.g., 3 of 5)
- **Hardware wallets**: Ledger/Trezor for all owners
- **Geographic distribution**: Owners in different locations
- **Time-lock**: Optional 48-hour delay for critical actions

### Upgrade Safety

**Storage Layout**:
- ✅ Only add new variables at the end
- ❌ Never reorder existing variables
- ❌ Never change variable types
- ✅ Use storage gaps for future flexibility

**Testing**:
```solidity
// Add storage gap for future variables
uint256[50] private __gap;
```

**Validation**:
```bash
# Check storage layout
npx hardhat check

# Run upgrade tests
npx hardhat test test/upgrades/*.test.ts
```

### Emergency Response

**Pause Protocol** (if exploit detected):
```typescript
// Via Gnosis Safe
const vault = await ethers.getContractAt('CreditVaultV3', VAULT_ADDRESS);
await vault.pause(); // Requires multi-sig
```

**Rollback Upgrade** (if issues found):
```typescript
// Deploy previous implementation
const PreviousImpl = await ethers.getContractFactory('CreditVaultV3');
await upgrades.upgradeProxy(PROXY_ADDRESS, PreviousImpl);
```

---

## 📊 Monitoring

### Contract Health Checks

```bash
# Check contract versions
npx hardhat run scripts/check-versions.ts --network arbitrumSepolia

# Verify ownership
npx hardhat run scripts/verify-ownership.ts --network arbitrumSepolia
```

### On-Chain Monitoring

- **Alchemy Webhooks**: Alert on admin function calls
- **Tenderly**: Monitor transaction patterns
- **Defender**: Automated security checks

---

## 🚨 Emergency Contacts

**Protocol Guardians** (Safe Owners):
1. Owner 1: [Contact Info]
2. Owner 2: [Contact Info]
3. Owner 3: [Contact Info]

**Escalation Path**:
1. Detect issue → Alert Safe owners
2. Assess severity → Determine response
3. Execute via Safe → 2 of 3 signatures
4. Communicate → Notify users
5. Post-mortem → Document learnings

---

## 📚 Resources

- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Gnosis Safe Docs](https://docs.safe.global/)
- [UUPS Pattern](https://eips.ethereum.org/EIPS/eip-1822)
- [Storage Gaps](https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps)
