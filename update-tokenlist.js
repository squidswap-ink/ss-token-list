const fetch = require('node-fetch');
const fs = require('fs');

const SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cm5z6t2jpmusf01z77ov4fb71/subgraphs/squidswap-v2/core/gn';
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/57073';

async function fetchTokens() {
  // First fetch from DexScreener to get logos
  const dexScreenerResponse = await fetch(DEXSCREENER_URL);
  const dexScreenerData = await dexScreenerResponse.json();
  
  // Create a map of token address to logo
  const tokenLogos = new Map();
  dexScreenerData.pairs?.forEach(pair => {
    if (pair.baseToken?.address && pair.baseToken?.logoURI) {
      tokenLogos.set(pair.baseToken.address.toLowerCase(), pair.baseToken.logoURI);
    }
    if (pair.quoteToken?.address && pair.quoteToken?.logoURI) {
      tokenLogos.set(pair.quoteToken.address.toLowerCase(), pair.quoteToken.logoURI);
    }
  });

  // Fetch tokens from subgraph
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
  
  const tokenList = {
    name: 'SquidSwap Token List',
    timestamp: new Date().toISOString(),
    version: {
      major: 1,
      minor: 0,
      patch: 0
    },
    tokens: result.data.tokens.map(token => ({
      chainId: 57073,
      address: token.id,
      name: token.name,
      symbol: token.symbol,
      decimals: parseInt(token.decimals),
      logoURI: tokenLogos.get(token.id.toLowerCase()) || undefined
    })),
    keywords: ['squidswap', 'default'],
    tags: {},
    logoURI: ''
  };

  // Log some stats
  const tokensWithLogos = tokenList.tokens.filter(t => t.logoURI).length;
  console.log(`Updated token list with ${tokenList.tokens.length} tokens`);
  console.log(`Found logos for ${tokensWithLogos} tokens`);

  fs.writeFileSync('tokenlist.json', JSON.stringify(tokenList, null, 2));
}

fetchTokens().catch(console.error);