// =============================================================================
// AUTONOMY LAYER — Notifications: Telegram primary, Discord/Slack secondary
// =============================================================================
// Premium lead alerts → Telegram team chat
// DM projects on X/Telegram using their social links from GeckoTerminal
// When agents can't complete a task → Telegram alert for manual intervention

import { sendMessage as sendTelegram, sendTeamNotification } from './telegram-client'
import { sendDirectMessage, lookupUserByHandle } from './x-client'

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
  ]

  if (lead.twitterHandle) msg.push(`Twitter: @${lead.twitterHandle}`)
  if (lead.telegramHandle) msg.push(`Telegram: @${lead.telegramHandle}`)
  if (lead.tokenAddress) msg.push(`Token: ${lead.tokenAddress.slice(0, 20)}...`)

  const result = await sendTeamNotification(msg.join('\n'))
  if (!result.ok) {
    console.warn('[Notify] Telegram alert failed:', result.error)
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
  // Try preferred platform first, fallback to the other
  if (preferredPlatform === 'x' && lead.twitterHandle) {
    const user = await lookupUserByHandle(lead.twitterHandle)
    if (user.ok && user.userId) {
      const dm = await sendDirectMessage(user.userId, message)
      if (dm.ok) return { ok: true, platform: 'x' }
    }
    // If X fails and we have Telegram, try that
    if (lead.telegramHandle) {
      const tg = await sendTelegram(lead.telegramHandle, message)
      if (tg.ok) return { ok: true, platform: 'telegram' }
    }
    return { ok: false, error: `Failed to DM @${lead.twitterHandle} on X` }
  }

  if (preferredPlatform === 'telegram' && lead.telegramHandle) {
    const tg = await sendTelegram(lead.telegramHandle, message)
    if (tg.ok) return { ok: true, platform: 'telegram' }
    // If Telegram fails and we have X, try that
    if (lead.twitterHandle) {
      const user = await lookupUserByHandle(lead.twitterHandle)
      if (user.ok && user.userId) {
        const dm = await sendDirectMessage(user.userId, message)
        if (dm.ok) return { ok: true, platform: 'x' }
      }
    }
    return { ok: false, error: `Failed to DM @${lead.telegramHandle} on Telegram` }
  }

  // No direct handle available
  return { ok: false, error: `No ${preferredPlatform} handle for ${lead.name}` }
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
