const fetch = require('node-fetch');
const fs = require('fs');

const SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cm5z6t2jpmusf01z77ov4fb71/subgraphs/squidswap-v2/core/gn';
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/search?q=squidswap';

async function fetchTokens() {
  // First fetch all pairs from DexScreener
  console.log('Fetching pairs from DexScreener...');
  const dexScreenerResponse = await fetch(DEXSCREENER_URL);
  const dexScreenerData = await dexScreenerResponse.json();
  
  console.log('DexScreener response:', JSON.stringify(dexScreenerData, null, 2));
  
  // Create a map for token logos
  const tokenLogos = new Map();
  
  // Process pairs to extract token logos
  if (dexScreenerData.pairs) {
    console.log(`Found ${dexScreenerData.pairs.length} pairs on DexScreener`);
    dexScreenerData.pairs.forEach(pair => {
      // Handle base token logo
      if (pair.baseToken?.address && pair.baseToken?.logoURI) {
        const baseAddress = pair.baseToken.address.toLowerCase();
        tokenLogos.set(baseAddress, pair.baseToken.logoURI);
        console.log(`Setting logo for ${pair.baseToken.symbol}: ${pair.baseToken.logoURI}`);
      }
      // Handle quote token logo
      if (pair.quoteToken?.address && pair.quoteToken?.logoURI) {
        const quoteAddress = pair.quoteToken.address.toLowerCase();
        tokenLogos.set(quoteAddress, pair.quoteToken.logoURI);
        console.log(`Setting logo for ${pair.quoteToken.symbol}: ${pair.quoteToken.logoURI}`);
      }
    });
  }

  // Then get tokens from subgraph
  console.log('\nFetching tokens from Subgraph...');
  const subgraphResponse = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          tokens {
            id
            name
            symbol
            decimals
          }
        }
      `
    })
  });

  const result = await subgraphResponse.json();
  const tokens = result.data.tokens;

  const tokenList = {
    name: 'SquidSwap Token List',
    timestamp: new Date().toISOString(),
    version: {
      major: 1,
      minor: 0,
      patch: 0
    },
    tokens: tokens.map(token => {
      const address = token.id.toLowerCase();
      const logoURI = tokenLogos.get(address);
      if (logoURI) {
        console.log(`Adding logo for ${token.symbol}: ${logoURI}`);
      }
      return {
        chainId: 57073,
        address: token.id,
        name: token.name,
        symbol: token.symbol,
        decimals: parseInt(token.decimals),
        logoURI: logoURI || undefined
      };
    }),
    keywords: ['squidswap', 'default'],
    tags: {},
    logoURI: ''
  };

  // Log some stats
  const tokensWithLogos = tokenList.tokens.filter(t => t.logoURI).length;
  console.log(`\nUpdated token list with ${tokenList.tokens.length} tokens`);
  console.log(`Found logos for ${tokensWithLogos} tokens`);

  fs.writeFileSync('tokenlist.json', JSON.stringify(tokenList, null, 2));
}

fetchTokens().catch(console.error);