// =============================================================================
// AUTONOMY LAYER — Event-Driven Agent Orchestrator
// =============================================================================
// GeckoTerminal → Scout scores → if PREMIUM → notify Telegram team
// → dispatchDM to project on X/Telegram → if reply → advance state
// → if agent stuck → requestManualIntervention on Telegram

import { AutonomyEvent, LeadStage, AgentId } from './types'
import { getConfig } from './scheduler'
import {
  notifyPremiumLead,
  dispatchDM,
  requestManualIntervention,
  sendLeadForReview,
  sendScanSummary,
  sendActionConfirmation,
  decodeCallback,
} from './notifications'
import { airtableClient } from '../airtable-client'
import { callAgent } from '../groq-client'

// ─── INTENT PARSING PROMPT ───────────────────────────────────────────────────

const INTENT_PROMPT = `You are analyzing a reply from a Web3 project founder.
Determine the intent based on their message. Respond with ONLY one word:
- "interested" — they want to learn more, ask questions, seem positive
- "not_interested" — they decline, say no, not a fit
- "unclear" — can't determine, needs human review

Examples:
"tell me more" → interested
"not right now" → not_interested
"what's the min pool size" → interested
"sounds like a scam" → not_interested
"can you explain how it works" → interested`

// ─── IN-MEMORY LEAD CACHE (for leads found during scan) ──────────────────────
// In production, use Airtable as source of truth. This cache bridges the gap
// between cron/scan finding leads and the orchestrator processing them.

interface CachedLead {
  id: string
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  why_good_fit: string
  pain_point: string
  estimated_treasury_size: string
  contact_handle: string
  source_signal: string
  snapshot_vote: string | null
  fit_score: number
  score_breakdown: Record<string, number>
  verdict: string
  hook: string
  status: string
  stage?: LeadStage
  qualified?: boolean
  readyForOnboarding?: boolean
  poolDeployed?: boolean
  lastContacted?: number | null
  twitterHandle?: string | null
  telegramHandle?: string | null
  // Aliases for notifyPremiumLead / dispatchDM compatibility
  score?: number
  name?: string
  ticker?: string
  mcap?: string
  painPoint?: string
  tokenAddress?: string | null
}

const leadCache = new Map<string, CachedLead>()

export function cacheLead(lead: CachedLead): void {
  leadCache.set(lead.id, { ...lead, stage: lead.stage || 'Scouted' })
}

export function getCachedLead(id: string): CachedLead | undefined {
  return leadCache.get(id)
}

// ─── EVENT HANDLER ───────────────────────────────────────────────────────────

export async function handleEvent(event: AutonomyEvent): Promise<void> {
  console.log(`[Orchestrator] Event: ${event.type}`, event.leadId || '')

  switch (event.type) {
    case 'SCAN_COMPLETE':
      await onScanComplete(event)
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

async function onScanComplete(event: AutonomyEvent): Promise<void> {
  const payload = event.payload || {}
  const leads = (payload.leads as CachedLead[]) || []
  const chainCount = (payload.chainCount as number) || 0

  console.log(`[Orchestrator] Scan complete — ${leads.length} leads to review`)

  // Cache all leads
  for (const lead of leads) {
    cacheLead(lead)
  }

  // Send each qualifying lead to Telegram for HITL review
  let premiumCount = 0

  for (const lead of leads) {
    if (lead.fit_score >= 7) {
      await sendLeadForReview({
        id: lead.id,
        project_name: lead.project_name,
        token_ticker: lead.token_ticker,
        fit_score: lead.fit_score,
        chain: lead.chain,
        estimated_mcap: lead.estimated_mcap,
        pain_point: lead.pain_point,
        hook: lead.hook,
        contact_handle: lead.contact_handle,
        verdict: lead.verdict,
        source_signal: lead.source_signal,
      })
      if (lead.verdict === 'PREMIUM') premiumCount++
    }
  }

  // Send scan summary
  await sendScanSummary(chainCount, leads.length, premiumCount, 0)
}

async function onLeadFound(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return
  const config = getConfig()
  const payload = (event.payload || {}) as Record<string, unknown>

  const lead: CachedLead = {
    id: event.leadId,
    project_name: (payload.project_name as string) || event.leadId,
    token_ticker: (payload.token_ticker as string) || '',
    chain: (payload.chain as string) || '',
    contract_address: (payload.contract_address as string) || '',
    estimated_mcap: (payload.estimated_mcap as string) || '',
    why_good_fit: (payload.why_good_fit as string) || '',
    pain_point: (payload.pain_point as string) || '',
    estimated_treasury_size: (payload.estimated_treasury_size as string) || '',
    contact_handle: (payload.contact_handle as string) || '',
    source_signal: (payload.source_signal as string) || '',
    snapshot_vote: (payload.snapshot_vote as string) || null,
    fit_score: Number(payload.fit_score) || 0,
    score_breakdown: (payload.score_breakdown as Record<string, number>) || {},
    verdict: (payload.verdict as string) || 'LEAD',
    hook: (payload.hook as string) || '',
    status: 'new',
    score: Number(payload.fit_score) || 0,
    name: (payload.project_name as string) || event.leadId,
    ticker: (payload.token_ticker as string) || '',
    mcap: (payload.estimated_mcap as string) || '',
    painPoint: (payload.pain_point as string) || '',
    twitterHandle: (payload.twitterHandle as string) || (payload.contact_handle as string)?.replace('@', '') || null,
    telegramHandle: (payload.telegramHandle as string) || null,
    tokenAddress: (payload.contract_address as string) || null,
  }

  cacheLead(lead)

  // Persist to Airtable
  try {
    await airtableClient.createLead({
      project_name: lead.project_name,
      token_ticker: lead.token_ticker,
      chain: lead.chain,
      contract_address: lead.contract_address,
      estimated_mcap: lead.estimated_mcap,
      why_good_fit: lead.why_good_fit,
      pain_point: lead.pain_point,
      estimated_treasury_size: lead.estimated_treasury_size,
      contact_handle: lead.contact_handle,
      source_signal: lead.source_signal,
      snapshot_vote: lead.snapshot_vote,
      fit_score: lead.fit_score,
      score_breakdown_json: JSON.stringify(lead.score_breakdown),
      verdict: lead.verdict,
      hook: lead.hook,
      status: 'new',
      created_by: 'autonomy-scout',
    })
    console.log(`[Orchestrator] Lead saved to Airtable: ${lead.project_name}`)
  } catch (err) {
    console.warn(`[Orchestrator] Failed to save lead to Airtable:`, err)
  }

  // Auto-handoff PREMIUM leads
  if (lead.fit_score >= config.autoHandoffThreshold) {
    console.log(`[Orchestrator] Auto-handoff: ${lead.project_name} (score ${lead.fit_score})`)

    if (config.notifyOnPremium) {
      await notifyPremiumLead({
        id: lead.id,
        name: lead.project_name,
        ticker: lead.token_ticker,
        score: lead.fit_score,
        chain: lead.chain,
        mcap: lead.estimated_mcap,
        painPoint: lead.pain_point,
        twitterHandle: lead.twitterHandle,
        telegramHandle: lead.telegramHandle,
        tokenAddress: lead.contract_address,
      })
    }

    const message = composeAutoMessage({
      name: lead.project_name,
      painPoint: lead.pain_point,
    })

    const dmResult = await dispatchDM(
      {
        name: lead.project_name,
        twitterHandle: lead.twitterHandle,
        telegramHandle: lead.telegramHandle,
      },
      message,
      'x'
    )

    if (dmResult.ok) {
      console.log(`[Orchestrator] DM sent via ${dmResult.platform} to ${lead.project_name}`)
      leadCache.set(lead.id, { ...lead, lastContacted: Date.now() })
      try {
        await airtableClient.updateLead(lead.id, { status: 'contacted', notes: `Auto-DM sent via ${dmResult.platform}` })
      } catch {}
    } else {
      await requestManualIntervention(
        lead.id,
        lead.project_name,
        `Auto-DM failed: ${dmResult.error}. Send outreach manually.`,
        {
          'X handle': lead.twitterHandle || 'none',
          'Telegram handle': lead.telegramHandle || 'none',
          'Pain point': lead.pain_point,
        }
      )
    }
  }
}

async function onLeadPromoted(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return

  let lead = getCachedLead(event.leadId)
  if (!lead) {
    // Try to fetch from Airtable
    try {
      const leads = await airtableClient.getLeads()
      const found = leads.find((r: any) => r.id === event.leadId)
      if (found) {
        lead = {
          id: found.id,
          project_name: found.fields.project_name || '',
          token_ticker: found.fields.token_ticker || '',
          chain: found.fields.chain || '',
          contract_address: found.fields.contract_address || '',
          estimated_mcap: found.fields.estimated_mcap || '',
          why_good_fit: found.fields.why_good_fit || '',
          pain_point: found.fields.pain_point || '',
          estimated_treasury_size: found.fields.estimated_treasury_size || '',
          contact_handle: found.fields.contact_handle || '',
          source_signal: found.fields.source_signal || '',
          snapshot_vote: found.fields.snapshot_vote || null,
          fit_score: Number(found.fields.fit_score) || 0,
          score_breakdown: {},
          verdict: found.fields.verdict || 'LEAD',
          hook: found.fields.hook || '',
          status: found.fields.status || 'new',
        }
        cacheLead(lead)
      }
    } catch {
      console.warn(`[Orchestrator] Could not fetch lead ${event.leadId} from Airtable`)
    }
  }

  if (!lead) {
    console.warn(`[Orchestrator] Lead ${event.leadId} not found for promotion`)
    return
  }

  const payload = (event.payload || {}) as Record<string, unknown>
  const nextAgent = (payload.agent as AgentId) || 'outreach'
  const newStage = (payload.newStage as LeadStage) || 'In conversation'

  console.log(`[Orchestrator] Lead promoted: ${lead.project_name} → ${nextAgent} (stage: ${newStage})`)

  // Update lead status in Airtable
  try {
    await airtableClient.updateLead(event.leadId, {
      status: newStage.toLowerCase().replace(' ', '_'),
      notes: `Promoted to ${nextAgent} agent at stage ${newStage}`,
    })
  } catch {}
}

async function onReplyReceived(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return
  const payload = (event.payload || {}) as Record<string, unknown>
  const text = (payload.text as string) || ''
  const platform = (payload.platform as string) || 'unknown'

  console.log(`[Orchestrator] Reply from ${event.leadId} on ${platform}: ${text.slice(0, 100)}`)

  // Parse intent using Groq
  try {
    const intent = await callAgent('qa', [
      { role: 'user', content: `Founder reply: "${text}"\n\nWhat is their intent?` },
    ], INTENT_PROMPT)

    const cleanIntent = intent.toLowerCase().trim()

    if (cleanIntent === 'interested') {
      console.log(`[Orchestrator] Lead ${event.leadId} is interested — advancing state`)

      // Update lead in Airtable
      try {
        await airtableClient.updateLead(event.leadId, {
          status: 'contacted',
          notes: `Lead expressed interest via ${platform}: "${text.slice(0, 200)}"`,
        })
      } catch {}

      // Check for next state transition
      const lead = getCachedLead(event.leadId)
      if (lead) {
        const cached = leadCache.get(event.leadId)
        if (cached) {
          leadCache.set(event.leadId, { ...cached, qualified: true })
        }
      }
    } else if (cleanIntent === 'not_interested') {
      console.log(`[Orchestrator] Lead ${event.leadId} not interested — marking disqualified`)
      try {
        await airtableClient.updateLead(event.leadId, {
          status: 'disqualified',
          notes: `Lead declined via ${platform}: "${text.slice(0, 200)}"`,
        })
      } catch {}
    } else {
      // Unclear — request manual intervention
      await requestManualIntervention(
        event.leadId,
        event.leadId,
        `Unclear reply intent on ${platform}`,
        { reply: text.slice(0, 500) }
      )
    }
  } catch (error: any) {
    console.warn(`[Orchestrator] Groq intent parsing failed:`, error.message)
    // Fallback: request manual intervention
    await requestManualIntervention(
      event.leadId,
      event.leadId,
      `Reply received but intent parsing failed on ${platform}`,
      { reply: text.slice(0, 500), error: error.message }
    )
  }
}

async function onCampaignLive(event: AutonomyEvent): Promise<void> {
  if (!event.leadId) return
  console.log(`[Orchestrator] Campaign live: ${event.leadId}`)

  const lead = getCachedLead(event.leadId)
  const name = lead?.project_name || event.leadId

  const { sendTeamNotification } = await import('./telegram-client')
  await sendTeamNotification(`*🎉 Campaign live!* ${name} pool is deployed.`)
}

// ─── ENRICHMENT CALLBACK PARSER ──────────────────────────────────────────────
// Enrichment callbacks are formatted as enrich_{action}_{leadId} (no hitl_ prefix)

function decodeEnrichmentCallback(raw: string): { action: string; leadId: string } | null {
  const prefixes = [
    'enrich_group_confirmed_', 'enrich_draft_approve_', 'enrich_draft_edit_',
    'enrich_review_', 'enrich_skip_',
  ]
  for (const prefix of prefixes) {
    if (raw.startsWith(prefix)) {
      return { action: prefix.slice(0, -1), leadId: raw.slice(prefix.length) }
    }
  }
  return null
}

  // ─── ENRICHMENT ACTION HANDLER ──────────────────────────────────────────────

async function handleEnrichmentAction(
  action: string,
  leadId: string,
): Promise<{ ok: boolean; responseText?: string }> {
  const lead = getCachedLead(leadId)

  // Group join confirmation → run profile filter + generate drafts
  if (action === 'enrich_group_confirmed') {
    console.log(`[Orchestrator] Enrichment: group join confirmed for ${leadId}`)
    try {
      const { handleHITLGroupConfirmation } = await import('./lead-enrichment-handler')
      const { runProfileFilter } = await import('./profile-filter-runner')
      const { generateFullDraft } = await import('./draft-generator')
      const { sendDraftForApproval, sendEnrichmentComplete } = await import('./telegram-client')

      const { getCachedContext } = await import('./lead-enrichment-handler')
      const context = getCachedContext(leadId)
      let groupTitle = 'community'

      if (context) {
        const { extractTelegramGroup } = await import('./geckoterminal-enrich')
        const tgLink = context.socialLinks?.telegram || null
        const extracted = extractTelegramGroup(tgLink)
        if (extracted) groupTitle = extracted
      }

      await handleHITLGroupConfirmation(leadId, groupTitle)
      const filterResult = await runProfileFilter(leadId, 0, groupTitle, [])

      const draftInput = {
        projectName: context?.projectName || lead?.project_name || leadId,
        chain: context?.chain || lead?.chain || '',
        painPoint: (context as any)?.painPoint || (context as any)?.pain_point || lead?.pain_point || '',
        hook: (context as any)?.hook || lead?.hook || '',
        verdict: lead?.verdict || 'LEAD',
        targetAudienceTags: filterResult.topTags || [],
        targetAudienceCount: filterResult.highValueProfiles?.length || 0,
        tokenTicker: lead?.token_ticker || '',
        estimatedMcap: lead?.estimated_mcap || '',
      }

      const fullDraft = await generateFullDraft(leadId, draftInput)
      await sendDraftForApproval(leadId, draftInput.projectName, fullDraft.outreach)
      await sendEnrichmentComplete(draftInput.projectName, draftInput.targetAudienceCount, filterResult.topTags || [])

      return { ok: true, responseText: 'Audience analysis done! Draft ready for review.' }
    } catch (err: any) {
      console.error(`[Orchestrator] Enrichment group confirm failed:`, err.message)
      return { ok: false, responseText: `Error: ${err.message}` }
    }
  }

  // Draft approval → send DM with approved outreach
  if (action === 'enrich_draft_approve') {
    console.log(`[Orchestrator] Enrichment: draft approved for ${leadId}`)
    try {
      const { handleHITLDraftApproval, getCachedContext } = await import('./lead-enrichment-handler')
      await handleHITLDraftApproval(leadId, true)

      const context = getCachedContext(leadId)
      const outreachDraft = context?.outreachDraft
      const projectName = context?.projectName || lead?.project_name || leadId

      if (outreachDraft && lead) {
        const dmResult = await dispatchDM(
          { name: projectName, twitterHandle: lead.twitterHandle, telegramHandle: lead.telegramHandle },
          outreachDraft,
          'x',
        )
        if (dmResult.ok) {
          try {
            await airtableClient.updateLead(leadId, { status: 'contacted', notes: `Enrichment DM sent via ${dmResult.platform}: "${outreachDraft.slice(0, 100)}..."` })
          } catch {}
          return { ok: true, responseText: `Draft approved! DM sent via ${dmResult.platform}.` }
        }
        try {
          await airtableClient.updateLead(leadId, { status: 'contacted', notes: `Draft approved but DM failed: ${dmResult.error}` })
        } catch {}
        return { ok: true, responseText: `Draft approved but DM failed: ${dmResult.error}. Send manually.` }
      }

      return { ok: true, responseText: 'Draft approved! (No outreach draft stored — send manually.)' }
    } catch (err: any) {
      console.error(`[Orchestrator] Enrichment draft approval failed:`, err.message)
      return { ok: false, responseText: `Error: ${err.message}` }
    }
  }

  // Edit draft → regenerate using LLM
  if (action === 'enrich_draft_edit') {
    console.log(`[Orchestrator] Enrichment: regenerate draft for ${leadId}`)
    try {
      const { getCachedContext, updateEnrichmentStep } = await import('./lead-enrichment-handler')
      const { generateFullDraft } = await import('./draft-generator')
      const { sendDraftForApproval } = await import('./telegram-client')

      const context = getCachedContext(leadId)
      if (!context) return { ok: false, responseText: 'No enrichment context found for this lead.' }

      const draftInput = {
        projectName: context.projectName,
        chain: context.chain,
        painPoint: '',
        hook: '',
        verdict: 'LEAD',
        targetAudienceTags: context.targetAudience?.map((p: any) => p.tags).flat() || [],
        targetAudienceCount: context.targetAudience?.length || 0,
        tokenTicker: '',
        estimatedMcap: '',
      }

      const newDraft = await generateFullDraft(leadId, draftInput)
      await updateEnrichmentStep(leadId, 'awaiting_approval', {
        outreachDraft: newDraft.outreach,
        onboardingDraft: newDraft.onboarding,
      })
      await sendDraftForApproval(leadId, context.projectName, newDraft.outreach)

      return { ok: true, responseText: 'Draft regenerated! Review the new version.' }
    } catch (err: any) {
      console.error(`[Orchestrator] Enrichment draft edit failed:`, err.message)
      return { ok: false, responseText: `Error: ${err.message}` }
    }
  }

  // Review → re-send current status
  if (action === 'enrich_review') {
    try {
      const { getCachedContext } = await import('./lead-enrichment-handler')
      const context = getCachedContext(leadId)
      const name = context?.projectName || lead?.project_name || leadId
      const step = context?.currentStep || 'unknown'
      return { ok: true, responseText: `Lead "${name}" is at step: ${step}. Check Telegram for details.` }
    } catch {
      return { ok: false, responseText: 'Could not retrieve review status.' }
    }
  }

  // Skip enrichment
  if (action === 'enrich_skip') {
    console.log(`[Orchestrator] Enrichment: skip lead ${leadId}`)
    try {
      const { handleHITLDraftApproval } = await import('./lead-enrichment-handler')
      await handleHITLDraftApproval(leadId, false)
      try {
        await airtableClient.updateLead(leadId, { status: 'skipped', notes: 'Skipped during enrichment' })
      } catch {}
      return { ok: true, responseText: 'Lead skipped' }
    } catch (err: any) {
      console.error(`[Orchestrator] Enrichment skip failed:`, err.message)
      return { ok: false, responseText: `Error: ${err.message}` }
    }
  }

  return { ok: false, responseText: `Unknown enrichment action: ${action}` }
}

// ─── HITL CALLBACK HANDLER ───────────────────────────────────────────────────
// Called by the Telegram webhook when an admin clicks an inline button.

export async function handleHITLCallback(
  callbackData: string,
): Promise<{ ok: boolean; responseText?: string }> {
  // ─── Enrichment callbacks (don't use the hitl_ prefix) ──────────────────
  const enriched = decodeEnrichmentCallback(callbackData)
  if (enriched) {
    return handleEnrichmentAction(enriched.action, enriched.leadId)
  }

  const decoded = decodeCallback(callbackData)
  if (!decoded) return { ok: false, responseText: 'Unknown callback' }

  const { action, leadId } = decoded
  
  // ──────────────────────────────────────────────────────────────────────────
  // ORIGINAL HITL CALLBACKS (legacy lead review)
  // ──────────────────────────────────────────────────────────────────────────

  const lead = getCachedLead(leadId)

  if (!lead) {
    // Try Airtable as fallback
    try {
      const leads = await airtableClient.getLeads()
      const found = leads.find((r: any) => r.id === leadId)
      if (found) {
        await sendActionConfirmation(action, leadId, 'Lead record found but not in cache')
        return { ok: true, responseText: `Lead processed from Airtable` }
      }
    } catch {}
    return { ok: false, responseText: 'Lead not found' }
  }

  switch (action) {
    case 'approve': {
      cacheLead({ ...lead, stage: 'In conversation' as LeadStage })
      try {
        await airtableClient.updateLead(lead.id, { status: 'contacted', notes: 'Approved by HITL admin' })
      } catch {}

      // Auto-DM
      const message = composeAutoMessage({ name: lead.project_name, painPoint: lead.pain_point })
      const dmResult = await dispatchDM(
        { name: lead.project_name, twitterHandle: lead.twitterHandle, telegramHandle: lead.telegramHandle },
        message,
        'x'
      )

      const status = dmResult.ok
        ? `DM sent via ${dmResult.platform}`
        : `DM failed: ${dmResult.error}. Manual outreach needed.`

      await sendActionConfirmation(action, lead.project_name, status)
      return { ok: true, responseText: `${lead.project_name} approved. ${status}` }
    }

    case 'skip': {
      try {
        await airtableClient.updateLead(lead.id, { status: 'disqualified', notes: 'Skipped by HITL admin' })
      } catch {}
      await sendActionConfirmation(action, lead.project_name, 'Skipped — marked disqualified')
      return { ok: true, responseText: `${lead.project_name} skipped` }
    }

    case 'discard': {
      try {
        await airtableClient.deleteLead(lead.id)
      } catch {}
      await sendActionConfirmation(action, lead.project_name, 'Discarded and removed')
      return { ok: true, responseText: `${lead.project_name} discarded` }
    }

    default:
      return { ok: false, responseText: `Unknown action: ${action}` }
  }
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
