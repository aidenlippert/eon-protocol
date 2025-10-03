# 🔑 Export Private Key from Talisman Wallet

## Step-by-Step Instructions

### Step 1: Open Talisman Extension

1. Click on the Talisman extension icon in your browser
2. Make sure you're logged in

### Step 2: Select Your Ethereum Account

1. In Talisman, click on **"Portfolio"** or your account list
2. Find your **Ethereum** account (not Polkadot/Substrate)
3. Click on the account you want to use for deployment

### Step 3: Export Private Key

1. Click on the **three dots (⋮)** or **settings icon** next to your account
2. Select **"Export Private Key"** or **"View Private Key"**
3. Enter your Talisman password to confirm
4. **Copy the private key** (it should start with `0x`)

### Step 4: Create .env File

```bash
cd /tmp/eon-protocol

# Create .env file with your private key
echo "PRIVATE_KEY=0xyour_private_key_here" > .env
```

**Replace `0xyour_private_key_here` with the actual private key from Talisman**

### Step 5: Get Testnet ETH

Your Talisman wallet needs Arbitrum Sepolia testnet ETH:

1. Copy your Ethereum address from Talisman
2. Visit: https://faucet.quicknode.com/arbitrum/sepolia
3. Paste your address
4. Request 0.1 ETH
5. Wait for transaction to confirm (~30 seconds)

### Step 6: Verify Balance

```bash
# Check your testnet ETH balance
npx hardhat console --network arbitrumSepolia

# In console, run:
const [signer] = await ethers.getSigners();
console.log("Address:", signer.address);
const balance = await signer.provider.getBalance(signer.address);
console.log("Balance:", ethers.formatEther(balance), "ETH");
```

### Step 7: Deploy!

```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

---

## ⚠️ Security Notes

- **NEVER** share your private key with anyone
- Use a **testnet-only** account for this deployment
- The `.env` file is in `.gitignore` and won't be committed
- Keep your private key secure and delete `.env` after deployment if needed

---

## 🐛 Troubleshooting

### "Cannot find account"
- Make sure you're using an **Ethereum** account, not Polkadot
- Talisman supports both - you need the EVM-compatible one

### "Insufficient funds"
- Visit the faucet again and request more testnet ETH
- Wait a few minutes for the transaction to confirm
- Check balance on: https://sepolia.arbiscan.io/address/YOUR_ADDRESS

### "Invalid private key"
- Ensure the private key starts with `0x`
- No spaces or extra characters
- Should be 66 characters total (0x + 64 hex chars)

---

## ✅ Quick Checklist

- [ ] Talisman wallet installed and unlocked
- [ ] Ethereum account selected (not Polkadot)
- [ ] Private key exported from Talisman
- [ ] `.env` file created with `PRIVATE_KEY=0x...`
- [ ] Testnet ETH received (check on Arbiscan)
- [ ] Ready to deploy!

---

**Once ready, run**: `npx hardhat run scripts/deploy.ts --network arbitrumSepolia`
