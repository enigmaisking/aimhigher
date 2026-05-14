// lib/scout-utils.ts
// Type definitions and utility functions for Strategic Lead Scout v3.0

/**
 * SCOUT V3.0 TYPES & UTILITIES
 * 
 * Provides shared types, constants, and helper functions for the Scout agent
 * and integration with the UI, Airtable, and Slack notification systems.
 */

// ────────────────────────────────────────────────────────────────
// CORE TYPES
// ────────────────────────────────────────────────────────────────

export interface Signal {
  source: 'x' | 'dexscreener' | 'dune'
  content: string
  author?: string
  timestamp: string
  platform_url?: string
  engagement?: number
  metadata?: Record<string, unknown>
}

export interface EngagementGap {
  tg_members: number | null
  discord_members: number | null
  volume_24h_usd: number
  holders_count: number | null
  ratio: number
  interpretation: string
}

export interface ScoreBreakdown {
  sector_alpha: number
  frustrated_founder: number
  engagement_gap: number
  chain_momentum: number
  total: number
}

export interface Lead {
  rank: number
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  estimated_treasury_size: string
  why_good_fit: string
  pain_point: string
  contact_handle: string
  source_signals: Signal[]
  engagement_gap: EngagementGap
  fit_score: number
  verdict: 'PREMIUM' | 'LEAD' | 'DISCARD'
  snapshot_vote: string | null
  score_breakdown: ScoreBreakdown
  hook: string
  next_action: string
}

export interface ScoutResponse {
  ok: boolean
  error?: string
  data?: {
    leads: Lead[]
    metadata: Record<string, unknown>
    signal_stats: Record<string, number>
  }
}

// ────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────

export const VERDICT_COLORS = {
  PREMIUM: '#22d3a0', // green
  LEAD: '#f59e0b', // amber
  DISCARD: '#6b6b80', // gray
}

export const VERDICT_EMOJIS = {
  PREMIUM: '🥇',
  LEAD: '🥈',
  DISCARD: '❌',
}

export const CHAIN_EMOJIS: Record<string, string> = {
  ethereum: '⬡',
  eth: '⬡',
  solana: '🟣',
  sol: '🟣',
  base: '🔵',
  arbitrum: '🔷',
  arb: '🔷',
  bnb: '🟡',
  'bnb chain': '🟡',
  polygon: '🔮',
  matic: '🔮',
  optimism: '🔴',
  op: '🔴',
  avalanche: '🔺',
  avax: '🔺',
  fantom: '👻',
  ftm: '👻',
}

export const SOURCE_ICONS: Record<string, string> = {
  x: '𝕏',
  dexscreener: '📊',
  dune: '📈',
  github: '🔧',
}

// ────────────────────────────────────────────────────────────────
// FORMATTING UTILITIES
// ────────────────────────────────────────────────────────────────

export function formatMcap(mcap: number): string {
  if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`
  if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(2)}K`
  return `$${mcap.toFixed(0)}`
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(2)}K`
  return `$${volume.toFixed(0)}`
}

export function getChainEmoji(chain: string): string {
  return CHAIN_EMOJIS[chain.toLowerCase()] || '🔗'
}

export function getVerdictBadge(
  verdict: 'PREMIUM' | 'LEAD' | 'DISCARD'
): { emoji: string; color: string; label: string } {
  return {
    emoji: VERDICT_EMOJIS[verdict],
    color: VERDICT_COLORS[verdict],
    label: verdict,
  }
}

// ────────────────────────────────────────────────────────────────
// SIGNAL ANALYSIS
// ────────────────────────────────────────────────────────────────

export function getSummaryStats(leads: Lead[]) {
  return {
    total: leads.length,
    premium: leads.filter((l) => l.verdict === 'PREMIUM').length,
    lead: leads.filter((l) => l.verdict === 'LEAD').length,
    avgScore: leads.length > 0 ? (leads.reduce((sum, l) => sum + l.fit_score, 0) / leads.length).toFixed(1) : '0',
    topScore: Math.max(...leads.map((l) => l.fit_score)),
  }
}

export function highlightPainPoint(text: string): string {
  const keywords = ['KOL', 'fake', 'wasted', 'dump', 'scam', 'zero results', 'ROI', 'marketing']
  let highlighted = text

  keywords.forEach((kw) => {
    const regex = new RegExp(`(${kw})`, 'gi')
    highlighted = highlighted.replace(regex, '**$1**')
  })

  return highlighted
}

export function parseEngagementGapSeverity(ratio: number): {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  recommendation: string
} {
  if (ratio > 100)
    return {
      severity: 'CRITICAL',
      recommendation: 'Strong gap signal—founder frustration likely. Priority outreach.',
    }
  if (ratio > 50)
    return {
      severity: 'HIGH',
      recommendation: 'Significant conversion issue. Standard outreach with gap stat.',
    }
  if (ratio > 20)
    return {
      severity: 'MEDIUM',
      recommendation: 'Mild gap. Include as secondary signal in pitch.',
    }

  return {
    severity: 'LOW',
    recommendation: 'Limited signal. Pair with other pain-point indicators.',
  }
}

// ────────────────────────────────────────────────────────────────
// AIRTABLE INTEGRATION
// ────────────────────────────────────────────────────────────────

export function leadToAirtableRecord(lead: Lead) {
  return {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    project_name: lead.project_name,
    token_ticker: lead.token_ticker,
    chain: lead.chain,
    contract_address: lead.contract_address,
    estimated_mcap: lead.estimated_mcap,
    estimated_treasury_size: lead.estimated_treasury_size,
    why_good_fit: lead.why_good_fit,
    pain_point: lead.pain_point,
    contact_handle: lead.contact_handle,
    fit_score: lead.fit_score,
    verdict: lead.verdict,
    hook: lead.hook,
    status: 'new',
    score_breakdown_json: JSON.stringify(lead.score_breakdown),
    engagement_gap_ratio: lead.engagement_gap.ratio.toFixed(1),
    engagement_gap_json: JSON.stringify(lead.engagement_gap),
    source_signals_json: JSON.stringify(lead.source_signals),
    snapshot_vote: lead.snapshot_vote || '',
    next_action: lead.next_action,
    created_at: new Date().toISOString(),
  }
}

// ────────────────────────────────────────────────────────────────
// SLACK NOTIFICATION
// ────────────────────────────────────────────────────────────────

export function buildSlackNotificationBlocks(lead: Lead) {
  const gap = parseEngagementGapSeverity(lead.engagement_gap.ratio)

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${VERDICT_EMOJIS[lead.verdict]} ${lead.verdict} LEAD: ${lead.project_name}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Chain*\n${getChainEmoji(lead.chain)} ${lead.chain}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score*\n${lead.fit_score}/10`,
        },
        {
          type: 'mrkdwn',
          text: `*Mcap*\n${lead.estimated_mcap}`,
        },
        {
          type: 'mrkdwn',
          text: `*Contact*\n${lead.contact_handle}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pain Point*\n${lead.pain_point.substring(0, 100)}...`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Engagement Gap*\n${lead.engagement_gap.ratio.toFixed(1)}x — ${gap.recommendation}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Hook*\n"${lead.hook.substring(0, 150)}..."`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Score Breakdown:\n' +
          `• Sector: ${lead.score_breakdown.sector_alpha.toFixed(1)}\n` +
          `• Frustration: ${lead.score_breakdown.frustrated_founder.toFixed(1)}\n` +
          `• Engagement Gap: ${lead.score_breakdown.engagement_gap.toFixed(1)}\n` +
          `• Chain Momentum: ${lead.score_breakdown.chain_momentum.toFixed(1)}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Open in Outreach',
            emoji: true,
          },
          value: lead.project_name,
          action_id: 'open_outreach',
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Details',
            emoji: true,
          },
          value: lead.contact_handle,
          action_id: 'view_details',
        },
      ],
    },
  ]
}

// ────────────────────────────────────────────────────────────────
// VALIDATION & ERROR HANDLING
// ────────────────────────────────────────────────────────────────

export function validateLead(lead: Partial<Lead>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!lead.project_name) errors.push('Missing project_name')
  if (!lead.token_ticker) errors.push('Missing token_ticker')
  if (!lead.chain) errors.push('Missing chain')
  if (lead.fit_score === undefined || lead.fit_score < 0 || lead.fit_score > 10)
    errors.push('Invalid fit_score (must be 0–10)')
  if (!lead.verdict || !['PREMIUM', 'LEAD', 'DISCARD'].includes(lead.verdict))
    errors.push('Invalid verdict')

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function sanitizeLeadForOutput(lead: Lead): Lead {
  return {
    ...lead,
    pain_point: lead.pain_point.substring(0, 500),
    why_good_fit: lead.why_good_fit.substring(0, 300),
    hook: lead.hook.substring(0, 200),
    source_signals: lead.source_signals.slice(0, 3), // Only top 3 signals
  }
}

// ────────────────────────────────────────────────────────────────
// SORTING & FILTERING
// ────────────────────────────────────────────────────────────────

export function filterLeadsByVerdict(
  leads: Lead[],
  verdicts: ('PREMIUM' | 'LEAD' | 'DISCARD')[]
): Lead[] {
  return leads.filter((l) => verdicts.includes(l.verdict))
}

export function sortLeadsByScore(leads: Lead[], ascending = false): Lead[] {
  return [...leads].sort((a, b) => (ascending ? a.fit_score - b.fit_score : b.fit_score - a.fit_score))
}

export function sortLeadsByEngagementGap(leads: Lead[], ascending = false): Lead[] {
  return [...leads].sort((a, b) =>
    ascending
      ? a.engagement_gap.ratio - b.engagement_gap.ratio
      : b.engagement_gap.ratio - a.engagement_gap.ratio
  )
}

// ────────────────────────────────────────────────────────────────
// BATCH OPERATIONS
// ────────────────────────────────────────────────────────────────

export async function saveLeadsToAirtable(
  leads: Lead[],
  endpoint = '/api/leads'
): Promise<{ saved: number; failed: number; errors: string[] }> {
  const results = { saved: 0, failed: 0, errors: [] as string[] }

  for (const lead of leads) {
    try {
      const record = leadToAirtableRecord(lead)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })

      if (res.ok) {
        results.saved++
      } else {
        results.failed++
        results.errors.push(`${lead.project_name}: ${res.statusText}`)
      }
    } catch (error) {
      results.failed++
      results.errors.push(`${lead.project_name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

export async function notifySlackOfPremiumLeads(
  leads: Lead[],
  webhookUrl?: string
): Promise<{ sent: number; failed: number }> {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL
  if (!url) return { sent: 0, failed: 0 }

  const premiumLeads = filterLeadsByVerdict(leads, ['PREMIUM'])
  const results = { sent: 0, failed: 0 }

  for (const lead of premiumLeads) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: buildSlackNotificationBlocks(lead),
        }),
      })

      if (res.ok) {
        results.sent++
      } else {
        results.failed++
      }
    } catch (error) {
      results.failed++
    }
  }

  return results
}
