const fetch = require('node-fetch');
const fs = require('fs');

if (!process.env.SUBGRAPH_URL) {
  console.error('Error: SUBGRAPH_URL environment variable is not set');
  process.exit(1);
}

const SUBGRAPH_URL = process.env.SUBGRAPH_URL;
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/search?q=squidswap';

async function fetchTokens() {
  // First fetch all pairs from DexScreener
  console.log('Fetching pairs from DexScreener...');
  const dexScreenerResponse = await fetch(DEXSCREENER_URL);
  const dexScreenerData = await dexScreenerResponse.json();
  
  console.log('DexScreener response:', JSON.stringify(dexScreenerData, null, 2));
  
  // Create a map for token logos
  const tokenLogos = new Map();
  const debugLog = {
    totalPairs: 0,
    pairs: [],
    logoAssignments: []
  };
  
  // Process pairs to extract token logos
  if (dexScreenerData.pairs) {
    debugLog.totalPairs = dexScreenerData.pairs.length;
    console.log(`Found ${dexScreenerData.pairs.length} pairs on DexScreener`);
    console.log('First pair sample:', JSON.stringify(dexScreenerData.pairs[0], null, 2));
    
    dexScreenerData.pairs.forEach((pair, index) => {
      const pairLog = {
        index: index + 1,
        baseToken: {
          symbol: pair.baseToken?.symbol,
          address: pair.baseToken?.address
        },
        quoteToken: {
          symbol: pair.quoteToken?.symbol,
          address: pair.quoteToken?.address
        },
        imageUrl: pair.info?.imageUrl,
        result: 'no_match'
      };
      
      // Extract token address from image URL if possible
      const imageUrlMatch = pair.info?.imageUrl?.match(/tokens\/ink\/(0x[a-fA-F0-9]{40})/);
      if (imageUrlMatch) {
        const imageTokenAddress = imageUrlMatch[1].toLowerCase();
        pairLog.imageTokenAddress = imageTokenAddress;
        
        // Check if this image matches either token
        if (pair.baseToken?.address?.toLowerCase() === imageTokenAddress) {
          tokenLogos.set(imageTokenAddress, pair.info.imageUrl);
          pairLog.result = 'matched_base';
          debugLog.logoAssignments.push({
            symbol: pair.baseToken.symbol,
            address: imageTokenAddress,
            imageUrl: pair.info.imageUrl
          });
        } else if (pair.quoteToken?.address?.toLowerCase() === imageTokenAddress) {
          tokenLogos.set(imageTokenAddress, pair.info.imageUrl);
          pairLog.result = 'matched_quote';
          debugLog.logoAssignments.push({
            symbol: pair.quoteToken.symbol,
            address: imageTokenAddress,
            imageUrl: pair.info.imageUrl
          });
        } else {
          pairLog.result = 'address_mismatch';
        }
      } else {
        pairLog.result = 'no_address_in_url';
      }
      
      debugLog.pairs.push(pairLog);
    });
  }
  
  // Write debug log to file
  fs.writeFileSync('debug_log.json', JSON.stringify(debugLog, null, 2));
  
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