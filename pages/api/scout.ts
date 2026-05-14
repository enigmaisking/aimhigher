import type { NextApiRequest, NextApiResponse } from 'next'

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2'

type SourceType = 'onchain' | 'x' | 'telegram' | 'reddit' | 'governance' | 'manual'
type RecipientType = 'founder' | 'dev' | 'agent' | 'kol' | 'influencer' | 'community'
type PlatformType = 'x' | 'telegram' | 'reddit' | 'discord' | 'email'
type HandoffAgent = 'scout' | 'outreach' | 'onboard' | 'qa'

interface GeckoPool {
  id: string
  attributes: {
    name: string
    symbol?: string
    address: string
    market_cap_usd?: string
    reserve_in_usd?: string
    volume_usd?: { h24?: string }
    price_percent_change?: { h24?: string }
  }
  relationships?: {
    base_token?: { data?: { id: string } }
  }
}

interface GeckoToken {
  id: string
  attributes: {
    name: string
    symbol: string
    address: string
    coingecko_coin_id?: string
    twitter_handle?: string
    telegram_handle?: string
    discord_url?: string
    websites?: { url: string }[]
  }
}

interface Project {
  name: string
  ticker: string
  chain: string
  mcap: number
  volume_24h: number
  price_change_24h: number
  reserve: number
  poolSource: string
  tokenAddress?: string
  twitterHandle?: string
  telegramHandle?: string
  websiteUrl?: string
}

interface LeadSource {
  platform: SourceType
  urlOrLabel: string
  signalText: string
  confidence: number
}

interface ScoreBreakdown {
  eligibility: number
  painSignal: number
  poolFit: number
  communityGap: number
  confidence: number
  total: number
}

const SCOUT_CONFIG = {
  MIN_MCAP: 30000,
  MAX_MCAP: 5000000,
  MIN_LIQUIDITY: 2500,
  LEAD_SCORE_THRESHOLD: 7,
  RATE_LIMIT_DELAY: 400,
  // When GeckoTerminal doesn't return market_cap_usd, estimate from reserve
  MCAP_RESERVE_MULTIPLIER: 25,
}

const CHAIN_MAP: Record<string, string> = {
  eth: 'eth',
  ethereum: 'eth',
  sol: 'solana',
  solana: 'solana',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon-pos',
  bnb: 'bsc',
  bsc: 'bsc',
  avax: 'avax',
  avalanche: 'avax',
  optimism: 'optimism',
  fantom: 'fantom',
  ftm: 'fantom',
}

const DEFAULT_CHAINS = ['eth', 'solana', 'bsc', 'base', 'avax', 'polygon-pos', 'arbitrum', 'optimism', 'fantom']



function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatUsd(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${Math.round(value / 1000)}K`
  return `$${Math.round(value)}`
}

function normalizeChain(chain: string) {
  const key = chain.toLowerCase()
  return CHAIN_MAP[key] || key
}

function displayChain(chain: string) {
  const labels: Record<string, string> = {
    eth: 'ETH',
    solana: 'Solana',
    bsc: 'BNB',
    base: 'Base',
    avax: 'AVAX',
    'polygon-pos': 'Polygon',
    arbitrum: 'Arbitrum',
    optimism: 'Optimism',
    fantom: 'Fantom',
  }
  return labels[chain] || chain
}

function inferVertical(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('real') || lower.includes('rwa')) return 'RWA'
  if (lower.includes('game') || lower.includes('quest')) return 'GameFi'
  if (lower.includes('ai') || lower.includes('agent')) return 'AI-Crypto'
  if (lower.includes('social') || lower.includes('stream')) return 'SocialFi'
  if (lower.includes('launch')) return 'Launchpad'
  return 'DeFi'
}

function inferPain(project: Project) {
  const volumeRatio = project.mcap > 0 ? project.volume_24h / project.mcap : 0
  if (volumeRatio < 0.04 && project.reserve >= 10000) {
    return 'Liquidity is present, but 24h wallet activity suggests community attention is not converting into enough buyers.'
  }
  if (Math.abs(project.price_change_24h) > 12) {
    return 'Momentum is visible, but the project needs capital-attributed incentives before attention fades.'
  }
  return 'The project has a live pool and enough reserve to test growth, but needs proof that contributors can drive real capital.'
}

function buildSources(project: Project, requestedSources: SourceType[], manualSignals: string[]): LeadSource[] {
  const sourceSet = requestedSources.length ? requestedSources : ['onchain', 'x', 'telegram', 'reddit', 'governance']
  const sources: LeadSource[] = [
    {
      platform: 'onchain',
      urlOrLabel: project.poolSource,
      signalText: `${formatUsd(project.reserve)} liquidity/reserve, ${formatUsd(project.volume_24h)} 24h volume, ${formatUsd(project.mcap)} market cap.`,
      confidence: 0.72,
    },
  ]

  if (sourceSet.includes('x')) {
    sources.push({
      platform: 'x',
      urlOrLabel: 'X/Twitter pain-signal queue',
      signalText: 'Scan for founder/team posts mentioning KOL ROI, fake reach, weak conversion, or incentive experiments.',
      confidence: 0.58,
    })
  }

  if (sourceSet.includes('telegram')) {
    sources.push({
      platform: 'telegram',
      urlOrLabel: 'Telegram/community channel queue',
      signalText: 'Look for active community discussion with low buyer follow-through or calls for growth incentives.',
      confidence: 0.52,
    })
  }

  if (sourceSet.includes('reddit')) {
    sources.push({
      platform: 'reddit',
      urlOrLabel: 'Reddit discovery queue',
      signalText: 'Monitor project, DeFi, RWA, and chain subreddits for frustration with paid promotion and quests.',
      confidence: 0.46,
    })
  }

  if (sourceSet.includes('governance')) {
    sources.push({
      platform: 'governance',
      urlOrLabel: 'Snapshot/Commonwealth proposal queue',
      signalText: 'Search for liquidity incentive, marketing fund, and growth pool proposals.',
      confidence: 0.66,
    })
  }

  manualSignals.filter(Boolean).forEach((signal, index) => {
    sources.push({
      platform: 'manual',
      urlOrLabel: `Manual signal ${index + 1}`,
      signalText: signal,
      confidence: 0.8,
    })
  })

  return sources.filter(source => source.platform === 'onchain' || sourceSet.includes(source.platform))
}

function scoreProject(project: Project, sources: LeadSource[]): ScoreBreakdown {
  const eligibility = project.mcap >= SCOUT_CONFIG.MIN_MCAP &&
    project.mcap <= SCOUT_CONFIG.MAX_MCAP &&
    project.reserve >= SCOUT_CONFIG.MIN_LIQUIDITY ? 2 : 0
  const painSignal = Math.min(2.5, sources.filter(source => source.platform !== 'onchain').reduce((sum, source) => sum + source.confidence, 0) / 1.4)
  const poolFit = Math.min(2.5, 1 + (project.reserve >= 10000 ? 0.7 : 0) + (project.reserve >= 25000 ? 0.5 : 0) + (project.volume_24h / Math.max(project.mcap, 1) < 0.05 ? 0.3 : 0))
  const communityGap = Math.min(1.5, project.volume_24h < 50000 ? 1.2 : 0.7)
  const confidence = Math.min(1.5, sources.reduce((sum, source) => sum + source.confidence, 0) / Math.max(sources.length, 1) * 1.7)
  const total = Number((eligibility + painSignal + poolFit + communityGap + confidence).toFixed(1))
  return { eligibility, painSignal: Number(painSignal.toFixed(1)), poolFit: Number(poolFit.toFixed(1)), communityGap: Number(communityGap.toFixed(1)), confidence: Number(confidence.toFixed(1)), total }
}

async function fetchGeckoPools(chain: string, endpoint: string): Promise<Project[]> {
  const projects: Project[] = []
  const geckoChain = normalizeChain(chain)
  const response = await fetch(`${GECKO_BASE}/networks/${geckoChain}/${endpoint}?limit=50&include=base_token`, {
    headers: { 'User-Agent': 'AimHigherScout/1.0' },
  })
  if (!response.ok) return projects

  const data = await response.json()
  const pools = (data.data || []) as GeckoPool[]
  const included = (data.included || []) as GeckoToken[]

  // Build a map of token id → attributes for quick lookup
  const tokenMap = new Map<string, GeckoToken>()
  for (const token of included) {
    if (token.attributes) tokenMap.set(token.id, token)
  }

  pools.forEach((pool) => {
    const rawMcap = Number(pool.attributes.market_cap_usd)
    const reserve = Number(pool.attributes.reserve_in_usd || 0)
    if (reserve < SCOUT_CONFIG.MIN_LIQUIDITY) return

    const mcap = rawMcap > 0
      ? rawMcap
      : reserve * SCOUT_CONFIG.MCAP_RESERVE_MULTIPLIER

    if (mcap < SCOUT_CONFIG.MIN_MCAP || mcap > SCOUT_CONFIG.MAX_MCAP) return

    // Look up token social links from included data
    const tokenId = pool.relationships?.base_token?.data?.id
    const tokenData = tokenId ? tokenMap.get(tokenId) : undefined

    projects.push({
      name: pool.attributes.name,
      ticker: pool.attributes.symbol || 'UNK',
      chain: displayChain(geckoChain),
      mcap: Math.round(mcap),
      volume_24h: Number(pool.attributes.volume_usd?.h24 || 0),
      price_change_24h: Number(pool.attributes.price_percent_change?.h24 || 0),
      reserve,
      poolSource: `GeckoTerminal ${endpoint} — ${pool.attributes.address}`,
      tokenAddress: tokenData?.attributes?.address || pool.attributes.address,
      twitterHandle: tokenData?.attributes?.twitter_handle,
      telegramHandle: tokenData?.attributes?.telegram_handle,
      websiteUrl: tokenData?.attributes?.websites?.[0]?.url,
    })
  })

  return projects
}

async function gatherGeckoSignals(chains: string[]): Promise<Project[]> {
  const seen = new Set<string>()
  const projects: Project[] = []
  const endpoints = ['trending_pools', 'new_pools']

  for (const chain of chains) {
    for (const endpoint of endpoints) {
      try {
        await sleep(SCOUT_CONFIG.RATE_LIMIT_DELAY)
        const batch = await fetchGeckoPools(chain, endpoint)
        for (const p of batch) {
          const key = `${p.ticker}-${p.chain}`.toLowerCase()
          if (!seen.has(key)) {
            seen.add(key)
            projects.push(p)
          }
        }
      } catch (error) {
        console.warn(`[Scout] ${endpoint} failed for ${chain}:`, error)
      }
    }
  }

  return projects
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const {
    chains = DEFAULT_CHAINS,
    sourceTypes = ['onchain', 'x', 'telegram', 'reddit', 'governance'],
    verticals = [],
    minimumScore = SCOUT_CONFIG.LEAD_SCORE_THRESHOLD,
    page = 1,
    pageSize = 10,
    manualSignals = [],
  } = req.body as {
    chains?: string[]
    sourceTypes?: SourceType[]
    verticals?: string[]
    minimumScore?: number
    page?: number
    pageSize?: number
    manualSignals?: string[]
  }

  const liveProjects = await gatherGeckoSignals(chains.length ? chains : DEFAULT_CHAINS)

  const leads = liveProjects
    .map((project) => {
      const sources = buildSources(project, sourceTypes, manualSignals)
      const scoreBreakdown = scoreProject(project, sources)
      const vertical = inferVertical(project.name)
      const painPoint = inferPain(project)

      return {
        id: `${project.ticker}-${project.chain}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        name: project.name,
        ticker: project.ticker.startsWith('$') ? project.ticker : `$${project.ticker}`,
        chain: project.chain,
        vertical,
        score: scoreBreakdown.total,
        verdict: scoreBreakdown.total >= 8.5 ? 'PREMIUM' : 'LEAD',
        stage: 'Scouted',
        mcap: formatUsd(project.mcap),
        treasury: formatUsd(project.reserve),
        painPoint,
        hook: `${project.name} looks like a fit because ${painPoint.toLowerCase()}`,
        nextAction: 'Hand off to Rex with the highest-confidence pain signal and one budget qualifier.',
        poolSource: project.poolSource,
        tokenAddress: project.tokenAddress,
        twitterHandle: project.twitterHandle || null,
        telegramHandle: project.telegramHandle || null,
        websiteUrl: project.websiteUrl || null,
        sources,
        scoreBreakdown,
        confidence: Number((scoreBreakdown.confidence / 1.5).toFixed(2)),
        recommendedRecipient: 'founder' as RecipientType,
        recommendedPlatform: 'x' as PlatformType,
        handoffAgent: 'outreach' as HandoffAgent,
      }
    })
    .filter(lead => lead.score >= minimumScore)
    .filter(lead => !verticals.length || verticals.includes(lead.vertical))
    .sort((a, b) => b.score - a.score)

  const start = (Math.max(1, page) - 1) * pageSize
  const pagedLeads = leads.slice(start, start + pageSize)

  return res.status(200).json({
    ok: true,
    data: {
      leads: pagedLeads,
      total: leads.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(leads.length / pageSize)),
      connectors: {
        live: ['GeckoTerminal trending pools', 'GeckoTerminal new pools'],
        planned: ['DexScreener token/pair search', 'X/Twitter pain search', 'Telegram channel review', 'Reddit thread scan', 'Snapshot/Commonwealth governance scan'],
      },
    },
  })
}
