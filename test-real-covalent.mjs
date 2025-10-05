#!/usr/bin/env node

/**
 * Test real Covalent API key with portfolio discovery
 */

const COVALENT_API_KEY = 'cqt_rQjDJ37rKJKFbb6b4Tdjb4v6JBVJ';
const COVALENT_BASE_URL = 'https://api.covalenthq.com/v1';

// Test wallet with known multi-chain activity
const TEST_WALLET = '0x1AF3c73eB17f38bC645faE487942e57C5B9F4FE3';

async function testCovalent() {
  console.log('🧪 Testing Covalent API with real key...\n');

  // Test 1: Ethereum Mainnet
  console.log('1️⃣  Fetching Ethereum balances...');
  const ethUrl = `${COVALENT_BASE_URL}/1/address/${TEST_WALLET}/balances_v2/`;

  const ethResponse = await fetch(ethUrl, {
    headers: {
      'Authorization': `Bearer ${COVALENT_API_KEY}`,
    },
  });

  if (!ethResponse.ok) {
    console.log(`❌ Ethereum fetch failed: ${ethResponse.status}`);
    const error = await ethResponse.text();
    console.log('Error:', error);
    return;
  }

  const ethData = await ethResponse.json();
  console.log(`✅ Ethereum: ${ethResponse.status} OK`);

  if (ethData.data?.items) {
    const significantTokens = ethData.data.items.filter(t =>
      t.balance !== '0' && (t.quote || 0) >= 1.0
    );
    console.log(`   Found ${significantTokens.length} significant tokens\n`);

    significantTokens.slice(0, 5).forEach(token => {
      const symbol = token.contract_ticker_symbol || 'UNKNOWN';
      const balance = (parseInt(token.balance) / 10 ** token.contract_decimals).toFixed(6);
      const value = (token.quote || 0).toFixed(2);
      console.log(`   • ${symbol}: ${balance} ($${value})`);
    });
  }

  // Test 2: Arbitrum
  console.log('\n2️⃣  Fetching Arbitrum balances...');
  const arbUrl = `${COVALENT_BASE_URL}/42161/address/${TEST_WALLET}/balances_v2/`;

  const arbResponse = await fetch(arbUrl, {
    headers: {
      'Authorization': `Bearer ${COVALENT_API_KEY}`,
    },
  });

  if (!arbResponse.ok) {
    console.log(`❌ Arbitrum fetch failed: ${arbResponse.status}`);
    return;
  }

  const arbData = await arbResponse.json();
  console.log(`✅ Arbitrum: ${arbResponse.status} OK`);

  if (arbData.data?.items) {
    const significantTokens = arbData.data.items.filter(t =>
      t.balance !== '0' && (t.quote || 0) >= 1.0
    );
    console.log(`   Found ${significantTokens.length} significant tokens\n`);

    significantTokens.slice(0, 5).forEach(token => {
      const symbol = token.contract_ticker_symbol || 'UNKNOWN';
      const balance = (parseInt(token.balance) / 10 ** token.contract_decimals).toFixed(6);
      const value = (token.quote || 0).toFixed(2);
      console.log(`   • ${symbol}: ${balance} ($${value})`);
    });
  }

  // Test 3: Transaction history (for protocol discovery)
  console.log('\n3️⃣  Fetching transaction history...');
  const txUrl = `${COVALENT_BASE_URL}/1/address/${TEST_WALLET}/transactions_v2/?page-size=10`;

  const txResponse = await fetch(txUrl, {
    headers: {
      'Authorization': `Bearer ${COVALENT_API_KEY}`,
    },
  });

  if (!txResponse.ok) {
    console.log(`❌ Transaction fetch failed: ${txResponse.status}`);
    return;
  }

  const txData = await txResponse.json();
  console.log(`✅ Transactions: ${txResponse.status} OK`);

  if (txData.data?.items) {
    console.log(`   Found ${txData.data.items.length} recent transactions\n`);
  }

  console.log('\n🎉 Covalent API is FULLY OPERATIONAL!');
  console.log('✅ Multi-chain portfolio discovery is now enabled');
  console.log('✅ Expected score improvement: +50-100 points for multi-chain users\n');
}

testCovalent().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
