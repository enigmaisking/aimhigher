// =============================================================================
// GECKOTERMINAL ENRICHMENT — Fetch project social links
// =============================================================================
// Uses GeckoTerminal API to retrieve social links (Twitter, Discord, Telegram, etc)
// for a discovered pool/project. These links are used to:
// 1. Contact the project (X DM, Telegram message)
// 2. Join community groups for profile-filter scanning

export interface SocialLinks {
  twitter?: string | null
  discord?: string | null
  telegram?: string | null
  website?: string | null
  github?: string | null
  other?: Record<string, string>
}

export interface EnrichedLead {
  projectName: string
  contractAddress: string
  chain: string
  socialLinks: SocialLinks
  poolUrl?: string
}

/**
 * Fetch social links for a project from GeckoTerminal API
 * GeckoTerminal v3 endpoint: GET /api/v3/networks/{networkId}/tokens/{tokenAddress}
 */
export async function fetchGeckoTerminalSocialLinks(
  contractAddress: string,
  chain: string
): Promise<SocialLinks> {
  try {
    const networkId = mapChainToNetworkId(chain)
    if (!networkId) {
      console.warn(`[GeckoTerminal] Unknown chain: ${chain}`)
      return {}
    }

    const normalizedAddress = contractAddress.toLowerCase()

    // Try tokens endpoint first, then pools as fallback
    const urls = [
      `https://api.geckoterminal.com/api/v3/networks/${networkId}/tokens/${normalizedAddress}`,
      `https://api.geckoterminal.com/api/v3/networks/${networkId}/pools/${normalizedAddress}`,
    ]

    for (const url of urls) {
      console.log(`[GeckoTerminal] Fetching from: ${url}`)
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'XAim-Autonomy/1.0',
        },
      })

      if (!response.ok) {
        console.warn(`[GeckoTerminal] ${url} returned ${response.status}`)
        continue
      }

      const data = await response.json()
      const item = data.data
      if (!item || !item.attributes) {
        console.warn(`[GeckoTerminal] No data at ${url}`)
        continue
      }

      const attrs = item.attributes
      const socialLinks = extractSocialLinks(attrs)
      console.log(`[GeckoTerminal] Found social links:`, socialLinks)
      return socialLinks
    }

    console.warn(`[GeckoTerminal] No data found for ${contractAddress} on ${chain} (tried tokens + pools)`)
    return {}
  } catch (error: any) {
    console.error(`[GeckoTerminal] Error fetching social links:`, error.message)
    return {}
  }
}

/**
 * Map blockchain names to GeckoTerminal network IDs
 */
function mapChainToNetworkId(chain: string): string | null {
  const chainMap: Record<string, string> = {
    // Solana
    'solana': 'solana',
    'sol': 'solana',

    // Ethereum
    'ethereum': 'eth',
    'eth': 'eth',

    // Base
    'base': 'base',

    // Arbitrum
    'arbitrum': 'arbitrum',
    'arb': 'arbitrum',

    // Polygon
    'polygon': 'polygon',
    'matic': 'polygon',

    // Optimism
    'optimism': 'optimism',
    'op': 'optimism',

    // Avalanche
    'avalanche': 'avax',
    'avax': 'avax',

    // BSC
    'binance': 'bsc',
    'bsc': 'bsc',

    // Fantom
    'fantom': 'fantom',
    'ftm': 'fantom',

    // Harmony
    'harmony': 'harmony',
    'one': 'harmony',

    // Celo
    'celo': 'celo',

    // Gnosis
    'gnosis': 'gnosis',

    // TON
    'ton': 'ton',

    // Sui
    'sui': 'sui',
  }

  const normalized = chain.toLowerCase().trim()
  return chainMap[normalized] || null
}

/**
 * Extract social links from GeckoTerminal token attributes
 */
function extractSocialLinks(attrs: Record<string, any>): SocialLinks {
  const links: SocialLinks = {}

  // GeckoTerminal returns social links in various formats
  // Look for common social link patterns

  // Twitter/X
  if (attrs.twitter_handle) {
    links.twitter = `https://twitter.com/${attrs.twitter_handle}`
  }

  // Telegram
  if (attrs.telegram_handle) {
    links.telegram = `https://t.me/${attrs.telegram_handle}`
  }

  // Discord
  if (attrs.discord_handle) {
    links.discord = `https://discord.gg/${attrs.discord_handle}`
  }

  // Website
  if (attrs.website_url) {
    links.website = attrs.website_url
  }

  // GitHub
  if (attrs.github_organizations) {
    const orgs = Array.isArray(attrs.github_organizations)
      ? attrs.github_organizations
      : [attrs.github_organizations]
    if (orgs.length > 0) {
      links.github = `https://github.com/${orgs[0]}`
    }
  }

  // Check for links object in attributes
  if (attrs.links) {
    const linksObj = attrs.links as Record<string, any>

    if (linksObj.twitter && !links.twitter) {
      links.twitter = linksObj.twitter
    }
    if (linksObj.telegram && !links.telegram) {
      links.telegram = linksObj.telegram
    }
    if (linksObj.discord && !links.discord) {
      links.discord = linksObj.discord
    }
    if (linksObj.website && !links.website) {
      links.website = linksObj.website
    }
    if (linksObj.github && !links.github) {
      links.github = linksObj.github
    }

    // Capture any other social links
    const otherLinks: Record<string, string> = {}
    for (const [key, value] of Object.entries(linksObj)) {
      if (
        !['twitter', 'telegram', 'discord', 'website', 'github'].includes(key) &&
        typeof value === 'string'
      ) {
        otherLinks[key] = value
      }
    }
    if (Object.keys(otherLinks).length > 0) {
      links.other = otherLinks
    }
  }

  return links
}

/**
 * Format social links for human-readable Telegram message
 */
export function formatSocialLinksForTelegram(links: SocialLinks): string {
  const lines: string[] = []

  if (links.twitter) {
    lines.push(`🐦 *Twitter/X:* [Visit](${links.twitter})`)
  }

  if (links.telegram) {
    lines.push(`✈️ *Telegram:* [Join](${links.telegram})`)
  }

  if (links.discord) {
    lines.push(`💬 *Discord:* [Join](${links.discord})`)
  }

  if (links.website) {
    lines.push(`🌐 *Website:* [Visit](${links.website})`)
  }

  if (links.github) {
    lines.push(`🔧 *GitHub:* [Visit](${links.github})`)
  }

  if (links.other) {
    for (const [key, value] of Object.entries(links.other)) {
      lines.push(`🔗 *${key}:* [Visit](${value})`)
    }
  }

  return lines.length > 0
    ? lines.join('\n')
    : '*No social links found on GeckoTerminal*'
}

/**
 * Extract group ID from telegram link
 * Supports: https://t.me/groupname, @groupname, or just groupname
 */
export function extractTelegramGroup(telegramLink: string | null): string | null {
  if (!telegramLink) return null

  const link = telegramLink.toLowerCase().trim()

  // Remove common prefixes
  let groupId = link
    .replace(/^https?:\/\/(www\.)?t\.me\//i, '')
    .replace(/^@/, '')
    .trim()

  // Remove query parameters
  groupId = groupId.split('?')[0]
  groupId = groupId.split('#')[0]

  return groupId || null
}

/**
 * Extract Twitter handle from Twitter link
 * Supports: https://twitter.com/handle, @handle, or just handle
 */
export function extractTwitterHandle(twitterLink: string | null): string | null {
  if (!twitterLink) return null

  const link = twitterLink.toLowerCase().trim()

  let handle = link
    .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, '')
    .replace(/^@/, '')
    .trim()

  // Remove query parameters
  handle = handle.split('?')[0]
  handle = handle.split('#')[0]

  return handle || null
}
