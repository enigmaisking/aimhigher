export const CHAINS = {
  eth:         { gecko: 'eth',         dex: 'ethereum',  airtable: 'Ethereum',  aliases: ['ethereum'],           evm: true  },
  solana:      { gecko: 'solana',      dex: 'solana',    airtable: 'Solana',    aliases: ['sol'],                evm: false },
  bsc:         { gecko: 'bsc',         dex: 'bsc',       airtable: 'BNB',       aliases: ['bnb'], legacy: ['BSC'], evm: true },
  base:        { gecko: 'base',        dex: 'base',      airtable: 'Base',      aliases: [],                     evm: true  },
  arbitrum:    { gecko: 'arbitrum',    dex: 'arbitrum',  airtable: 'Arbitrum',  aliases: ['arb'],                evm: true  },
  'polygon-pos': { gecko: 'polygon-pos', dex: 'polygon', airtable: 'Polygon',   aliases: ['polygon', 'matic'],   evm: true  },
  avax:        { gecko: 'avax',        dex: 'avalanche', airtable: 'AVAX',      aliases: ['avalanche'], legacy: ['Avalanche'], evm: true },
  optimism:    { gecko: 'optimism',    dex: 'optimism',  airtable: 'Optimism',  aliases: ['op'],                 evm: true  },
  fantom:      { gecko: 'fantom',      dex: 'fantom',    airtable: 'Fantom',    aliases: ['ftm'],                evm: true  },
} as const
export type ChainId = keyof typeof CHAINS

export function resolveChain(input: string): ChainId {
  const normalized = input.trim().toLowerCase()
  const match = (Object.entries(CHAINS) as [ChainId, (typeof CHAINS)[ChainId]][]).find(([key, chain]) =>
    key === normalized || chain.aliases.some((alias) => alias === normalized)
  )
  if (!match) throw new Error(`Unknown chain: ${input}`)
  return match[0]
}
