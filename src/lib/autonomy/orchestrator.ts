// =============================================================================
// AUTONOMY LAYER — Event-Driven Agent Orchestrator
// =============================================================================
// GeckoTerminal → Scout scores → if PREMIUM → notify Telegram team
// → dispatchDM to project on X/Telegram → if reply → advance state
// → if agent stuck → requestManualIntervention on Telegram

import { AutonomyEvent } from './types'
import { getConfig } from './scheduler'
import { notifyPremiumLead, dispatchDM, requestManualIntervention } from './notifications'

// ─── EVENT HANDLER ───────────────────────────────────────────────────────────

export async function handleEvent(event: AutonomyEvent): Promise<void> {
  console.log(`[Orchestrator] Event: ${event.type}`, event.leadId || '')

  switch (event.type) {
    case 'SCAN_COMPLETE':
      await onScanComplete()
      break
    case 'LEAD_FOUND':
      await onLeadFound(event)
      break
    case 'LEAD_PROMOTED':
      await onLeadPromoted(event)
      break
    case 'REPLY_RECEIVED':
      await onReplyReceived(event)
      break
    case 'CAMPAIGN_LIVE':
      await onCampaignLive(event)
      break
    default:
      console.warn(`[Orchestrator] Unknown event type: ${event.type}`)
  }
}

// ─── EVENT HANDLERS ──────────────────────────────────────────────────────────

async function onScanComplete(_event?: AutonomyEvent): Promise<void> {
  console.log('[Orchestrator] Scan complete — checking leads for auto-handoff...')
  // TODO: fetch leads from persistent store, check isEligibleForOutreach
}

async function onLeadFound(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return
  const config = getConfig()
  const payload = (event.payload || {}) as Record<string, unknown>

  const lead = {
    id: event.leadId,
    name: (payload.name as string) || event.leadId,
    ticker: (payload.ticker as string) || '',
    score: (payload.score as number) || 0,
    chain: (payload.chain as string) || '',
    mcap: (payload.mcap as string) || '',
    painPoint: (payload.painPoint as string) || '',
    twitterHandle: (payload.twitterHandle as string) || null,
    telegramHandle: (payload.telegramHandle as string) || null,
    tokenAddress: (payload.tokenAddress as string) || null,
  }

  // Auto-handoff PREMIUM leads
  if (lead.score >= config.autoHandoffThreshold) {
    console.log(`[Orchestrator] Auto-handoff: ${lead.name} (score ${lead.score})`)

    // 1. Notify team on Telegram
    if (config.notifyOnPremium) {
      await notifyPremiumLead(lead)
    }

    // 2. Compose outreach message
    const message = composeAutoMessage(lead)

    // 3. Try to DM on X first, fallback to Telegram
    const dmResult = await dispatchDM(lead, message, 'x')

    if (dmResult.ok) {
      console.log(`[Orchestrator] DM sent via ${dmResult.platform} to ${lead.name}`)
      // TODO: save DM status to lead record
    } else {
      // If DM failed, request manual intervention
      await requestManualIntervention(
        lead.id,
        lead.name,
        `Auto-DM failed: ${dmResult.error}. Send outreach manually.`,
        {
          'X handle': lead.twitterHandle || 'none',
          'Telegram handle': lead.telegramHandle || 'none',
          'Pain point': lead.painPoint,
        }
      )
    }

    // TODO: advance lead stage in persistent store
  }
}

async function onLeadPromoted(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return

  // TODO: fetch lead from store, determine next agent
  const payload = (event.payload || {}) as Record<string, unknown>
  const nextAgent = (payload.agent as string) || 'scout'

  console.log(`[Orchestrator] Lead promoted: ${event.leadId} → ${nextAgent}`)
}

async function onReplyReceived(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return
  const payload = (event.payload || {}) as Record<string, unknown>
  const text = (payload.text as string) || ''
  const platform = (payload.platform as string) || 'unknown'

  console.log(`[Orchestrator] Reply from ${event.leadId} on ${platform}: ${text.slice(0, 100)}`)

  // TODO: parse intent via Groq, advance state machine
  // If interested → move to "In conversation" or "Qualified"
  // If not interested → move to "Disqualified"
  // If unclear → requestManualIntervention for human review

  await requestManualIntervention(
    event.leadId,
    'Unknown',
    `Reply received on ${platform} — needs human review.`,
    { reply: text }
  )
}

async function onCampaignLive(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return

  console.log(`[Orchestrator] Campaign live: ${event.leadId}`)
  await sendTeamNotification(`*🎉 Campaign live!* ${event.leadId} pool is deployed.`)
}

// ─── AUTO-OUTREACH MESSAGE COMPOSER ──────────────────────────────────────────

function composeAutoMessage(lead: {
  name: string
  painPoint: string
}): string {
  return (
    `Hey! I noticed ${lead.name} has a growth opportunity: ${lead.painPoint} ` +
    `AimHigher lets you reward contributors for driving real on-chain capital, not just impressions. ` +
    `Would you be open to a quick chat about setting up a pilot pool?`
  )
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

async function sendTeamNotification(text: string): Promise<void> {
  const { sendTeamNotification } = await import('./telegram-client')
  const result = await sendTeamNotification(text)
  if (!result.ok) console.warn('[Orch] Team notification failed:', result.error)
}
