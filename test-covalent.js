/**
 * Quick test of Covalent API integration
 */

const COVALENT_API_KEY = 'cqt_rQkg4KBX8C9WKcWvwhjbkfYJhJVR';
const COVALENT_BASE_URL = 'https://api.covalenthq.com/v1';
const TEST_ADDRESS = '0x1AF3c73eB17f38bC645faE487942e57C5B9F4FE3';

async function testCovalent() {
  console.log('🧪 Testing Covalent API Integration\n');
  console.log(`Testing wallet: ${TEST_ADDRESS}\n`);

  // Test 1: Ethereum Mainnet balances
  console.log('📊 Fetching Ethereum Mainnet balances...');
  const ethUrl = `${COVALENT_BASE_URL}/1/address/${TEST_ADDRESS}/balances_v2/`;

  try {
    const response = await fetch(ethUrl, {
      headers: {
        'Authorization': `Bearer ${COVALENT_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.log(`❌ Ethereum fetch failed: ${response.status}`);
      return;
    }

    const data = await response.json();

    if (!data.data || !data.data.items) {
      console.log('❌ No data returned');
      return;
    }

    const tokens = data.data.items.filter(item => parseFloat(item.balance) > 0);

    console.log(`✅ Found ${tokens.length} tokens on Ethereum:`);

    tokens.slice(0, 10).forEach(token => {
      const balance = (parseInt(token.balance) / (10 ** token.contract_decimals)).toFixed(4);
      const value = token.quote || 0;
      console.log(`  - ${token.contract_ticker_symbol}: ${balance} ($${value.toFixed(2)})`);
    });

    // Calculate total
    const totalValue = tokens.reduce((sum, t) => sum + (t.quote || 0), 0);
    console.log(`\n💰 Total Portfolio Value (Ethereum): $${totalValue.toFixed(2)}`);

    // Test 2: Arbitrum balances
    console.log('\n📊 Fetching Arbitrum balances...');
    const arbUrl = `${COVALENT_BASE_URL}/42161/address/${TEST_ADDRESS}/balances_v2/`;

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
    const arbTokens = arbData.data?.items?.filter(item => parseFloat(item.balance) > 0) || [];

    console.log(`✅ Found ${arbTokens.length} tokens on Arbitrum`);

    arbTokens.slice(0, 5).forEach(token => {
      const balance = (parseInt(token.balance) / (10 ** token.contract_decimals)).toFixed(4);
      const value = token.quote || 0;
      console.log(`  - ${token.contract_ticker_symbol}: ${balance} ($${value.toFixed(2)})`);
    });

    const arbTotal = arbTokens.reduce((sum, t) => sum + (t.quote || 0), 0);
    console.log(`\n💰 Total Portfolio Value (Arbitrum): $${arbTotal.toFixed(2)}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 MULTI-CHAIN PORTFOLIO SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Value: $${(totalValue + arbTotal).toFixed(2)}`);
    console.log(`Unique Tokens: ${tokens.length + arbTokens.length}`);
    console.log(`\n✅ Covalent API integration is WORKING!`);
    console.log('   This data will boost your credit score significantly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCovalent();
