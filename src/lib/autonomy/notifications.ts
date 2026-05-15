// =============================================================================
// AUTONOMY LAYER — Notifications: Telegram primary, Discord/Slack secondary
// =============================================================================
// Premium lead alerts → Telegram team chat with HITL approve/skip buttons
// DM projects on X/Telegram using their social links from GeckoTerminal
// When agents can't complete a task → Telegram alert for manual intervention

import { sendMessage as sendTelegram, sendTeamNotification } from './telegram-client'
import { sendDirectMessage, lookupUserByHandle } from './x-client'

// ─── HITL CALLBACK DATA FORMAT ──────────────────────────────────────────────
// We encode the action + lead record ID in Telegram callback_data.
// Telegram inline buttons send this back when clicked.

const HITL_PREFIX = 'hitl'

export function encodeCallback(action: string, leadId: string): string {
  return `${HITL_PREFIX}_${action}_${leadId}`
}

export function decodeCallback(raw: string): { action: string; leadId: string } | null {
  const parts = raw.split('_')
  if (parts.length < 3 || parts[0] !== HITL_PREFIX) return null
  return { action: parts[1], leadId: parts.slice(2).join('_') }
}

// ─── PREMIUM LEAD ALERT (Telegram primary) ───────────────────────────────────

export async function notifyPremiumLead(lead: {
  id?: string
  name: string
  ticker: string
  score: number
  chain: string
  mcap: string
  painPoint: string
  twitterHandle?: string | null
  telegramHandle?: string | null
  websiteUrl?: string | null
  discordUrl?: string | null
  tokenAddress?: string | null
}): Promise<void> {
  const msg = [
    `*PREMIUM Lead: ${lead.name}*`,
    `Ticker: ${lead.ticker}  |  Score: ${lead.score}/10  |  Chain: ${lead.chain}`,
    `Mcap: ${lead.mcap}`,
    ``,
    `*Pain point:*`,
    lead.painPoint,
    ``,
    `*Social links:*`,
  ]

  if (lead.twitterHandle) msg.push(`🐦 X: ${lead.twitterHandle}`)
  if (lead.telegramHandle) msg.push(`✈️ Telegram: ${lead.telegramHandle}`)
  if (lead.websiteUrl) msg.push(`🌐 Website: ${lead.websiteUrl}`)
  if (lead.discordUrl) msg.push(`💬 Discord: ${lead.discordUrl}`)
  if (lead.tokenAddress) msg.push(`Token: ${lead.tokenAddress.slice(0, 20)}...`)

  const result = await sendTeamNotification(msg.join('\n'))
  if (!result.ok) {
    console.warn('[Notify] Telegram alert failed:', result.error)
  }
}

// ─── HITL CARD: Send a single lead for human review ──────────────────────────

export async function sendLeadForReview(lead: {
  id: string
  project_name: string
  token_ticker: string
  fit_score: number
  chain: string
  estimated_mcap: string
  pain_point: string
  hook: string
  contact_handle: string
  verdict: string
  source_signal: string
  twitterHandle?: string | null
  telegramHandle?: string | null
  websiteUrl?: string | null
  discordUrl?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const verdictEmoji = lead.verdict === 'PREMIUM' ? '🥇' : '🥈'
  const socialLines: string[] = []
  if (lead.twitterHandle) socialLines.push(`🐦 X: ${lead.twitterHandle}`)
  if (lead.telegramHandle) socialLines.push(`✈️ Telegram: ${lead.telegramHandle}`)
  if (lead.websiteUrl) socialLines.push(`🌐 Website: ${lead.websiteUrl}`)
  if (lead.discordUrl) socialLines.push(`💬 Discord: ${lead.discordUrl}`)

  const text = [
    `${verdictEmoji} *${lead.verdict} LEAD: ${lead.project_name}*`,
    `Ticker: \`${lead.token_ticker}\`  |  Score: *${lead.fit_score}/10*`,
    `Chain: ${lead.chain}  |  Mcap: ${lead.estimated_mcap}`,
    ``,
    socialLines.length > 0 ? `*Social:* ${socialLines.join(' · ')}` : '',
    `*Pain point:*`,
    lead.pain_point ? `> ${lead.pain_point.slice(0, 300)}` : '_None captured_',
    ``,
    `*Hook:*`,
    lead.hook ? `${lead.hook.slice(0, 200)}` : '_Auto-generated_',
    ``,
    `Contact: ${lead.contact_handle || '_Unknown_'}`,
    `Signal: ${lead.source_signal || 'Scout scan'}`,
  ].filter(Boolean).join('\n')

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID not configured' }

  return sendMessageWithButtons(chatId, text, [
    [
      { text: '✅ Approve & DM', callback_data: encodeCallback('approve', lead.id) },
      { text: '⏭️ Skip', callback_data: encodeCallback('skip', lead.id) },
      { text: '❌ Discard', callback_data: encodeCallback('discard', lead.id) },
    ],
  ])
}

// ─── HITL CARD: Scan summary ─────────────────────────────────────────────────

export async function sendScanSummary(
  chainCount: number,
  leadsFound: number,
  premiumCount: number,
  approvedCount: number
): Promise<void> {
  const text = [
    `📊 *Scan Complete*`,
    ``,
    `Chains scanned: ${chainCount}`,
    `Leads found: ${leadsFound}`,
    `Premium leads: ${premiumCount}`,
    `Approved: ${approvedCount}`,
    ``,
    leadsFound > 0
      ? `Review each lead above and approve or skip.`
      : `No qualifying leads found this cycle.`,
  ].join('\n')

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (chatId) {
    await sendMessageWithButtons(chatId, text, [])
  }
}

// ─── HITL CARD: Confirmation after action ────────────────────────────────────

export async function sendActionConfirmation(
  action: string,
  projectName: string,
  status: string
): Promise<void> {
  const emojis: Record<string, string> = {
    approve: '✅',
    skip: '⏭️',
    discard: '❌',
  }
  const emoji = emojis[action] || '📝'

  const text = `${emoji} *${projectName}* — ${status}`
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (chatId) {
    await sendMessageWithButtons(chatId, text, [])
  }
}

// ─── SEND TELEGRAM MESSAGE WITH INLINE BUTTONS ───────────────────────────────

async function sendMessageWithButtons(
  chatId: string,
  text: string,
  buttons: { text: string; callback_data: string }[][]
): Promise<{ ok: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }

  try {
    const body: Record<string, any> = {
      chat_id: Number(chatId),
      text,
      parse_mode: 'Markdown',
    }
    if (buttons.length > 0) {
      body.reply_markup = { inline_keyboard: buttons }
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!data.ok) {
      return { ok: false, error: `Telegram error: ${data.description}` }
    }
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

// ─── DM DISPATCHER ───────────────────────────────────────────────────────────
// Attempts to DM a project on X or Telegram using their social links.

export async function dispatchDM(
  lead: {
    name: string
    twitterHandle?: string | null
    telegramHandle?: string | null
  },
  message: string,
  preferredPlatform: 'x' | 'telegram'
): Promise<{ ok: boolean; platform?: string; error?: string }> {
  // Telegram is always priority when available
  if (lead.telegramHandle) {
    const tg = await sendTelegram(lead.telegramHandle, message)
    if (tg.ok) return { ok: true, platform: 'telegram' }
  }

  // Fallback to X/Twitter
  if (lead.twitterHandle) {
    const user = await lookupUserByHandle(lead.twitterHandle)
    if (user.ok && user.userId) {
      const dm = await sendDirectMessage(user.userId, message)
      if (dm.ok) return { ok: true, platform: 'x' }
    }
    return { ok: false, error: `Failed to DM @${lead.twitterHandle} on X` }
  }

  // No handle available on preferred platform
  return { ok: false, error: `No reachable handle for ${lead.name}` }
}

// ─── MANUAL INTERVENTION REQUEST ─────────────────────────────────────────────
// Sent to Telegram team chat when autonomous agents can't complete a task.

export async function requestManualIntervention(
  leadId: string,
  leadName: string,
  reason: string,
  context?: Record<string, unknown>
): Promise<void> {
  const msg = [
    `*⚠️ Manual intervention needed*`,
    `Lead: ${leadName} (${leadId})`,
    `Reason: ${reason}`,
  ]

  if (context) {
    for (const [key, val] of Object.entries(context)) {
      if (val) msg.push(`${key}: ${val}`)
    }
  }

  msg.push(``)
  msg.push(`Action required: Complete the onboarding/setup process manually.`)

  const result = await sendTeamNotification(msg.join('\n'))
  if (!result.ok) {
    console.warn('[Manual] Telegram notification failed:', result.error)
  }
}

// ─── AGENT STUCK ALERT ───────────────────────────────────────────────────────
// Called when an agent can't make progress and needs human help.

export async function agentStuck(
  agent: string,
  leadName: string,
  step: string,
  details: string
): Promise<void> {
  await requestManualIntervention(
    `agent_${agent}`,
    leadName,
    `${agent} agent stuck at step: ${step}`,
    { details }
  )
}
