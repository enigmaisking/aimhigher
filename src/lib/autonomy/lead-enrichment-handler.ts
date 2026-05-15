// =============================================================================
// LEAD ENRICHMENT HANDLER — Multi-step HITL workflow state manager
// =============================================================================
// Manages the enrichment workflow:
// 1. Hand off lead → fetch social links from GeckoTerminal
// 2. Ask HITL to join group/follow X → wait for confirmation
// 3. Run profile-filter to identify target audience
// 4. Generate LLM draft for outreach + onboarding
// 5. HITL reviews and approves/skips

import { fetchGeckoTerminalSocialLinks, formatSocialLinksForTelegram, SocialLinks } from './geckoterminal-enrich'
import { airtableClient } from '../airtable-client'

// ─── ENRICHMENT STATE ────────────────────────────────────────────────────────

export type EnrichmentStep = 
  | 'waiting_social_links'     // Fetching from GeckoTerminal
  | 'awaiting_group_join'       // Waiting for HITL to join group
  | 'running_profile_filter'    // Analyzing Telegram group members
  | 'generating_draft'          // LLM creating outreach message
  | 'awaiting_approval'         // HITL reviews draft
  | 'completed'                 // Ready to send outreach
  | 'skipped'                   // HITL skipped

export interface EnrichmentContext {
  leadId: string
  projectName: string
  contractAddress: string
  chain: string
  currentStep: EnrichmentStep
  socialLinks?: SocialLinks
  groupId?: string              // Telegram group to scan
  targetAudience?: any[]        // Filtered profiles from group
  outreachDraft?: string        // LLM-generated message
  onboardingDraft?: string      // LLM-generated onboarding
  startedAt: number
  updatedAt: number
  hitlApproved?: boolean
  reminders?: number            // Count of reminders sent
}

// In-memory cache for enrichment contexts
// In production, store in Airtable or Redis
const enrichmentCache = new Map<string, EnrichmentContext>()

export function getCachedContext(leadId: string): EnrichmentContext | undefined {
  return enrichmentCache.get(leadId)
}

export function setCachedContext(context: EnrichmentContext): void {
  enrichmentCache.set(context.leadId, {
    ...context,
    updatedAt: Date.now(),
  })
}

// ─── STEP 1: FETCH SOCIAL LINKS ─────────────────────────────────────────────

export async function enrichWithSocialLinks(
  leadId: string,
  projectName: string,
  contractAddress: string,
  chain: string,
  ticker?: string
): Promise<EnrichmentContext> {
  console.log(`[Enrichment] Step 1: Fetching social links for ${projectName}`)

  try {
    // Resolve real Airtable record ID
    let airtableRecordId = leadId
    try {
      let existing = null
      if (contractAddress) {
        existing = await airtableClient.findLeadByContract(contractAddress, chain)
      }
      if (!existing) {
        existing = await airtableClient.findLeadByNameChain(projectName, chain)
      }
      if (existing) {
        airtableRecordId = existing.id
        console.log(`[Enrichment] Found existing Airtable record: ${airtableRecordId}`)
      } else {
        const newRecord = await airtableClient.createLead({
          project_name: projectName,
          token_ticker: ticker || projectName.slice(0, 10),
          contract_address: contractAddress,
          chain,
          status: 'new',
        })
        airtableRecordId = newRecord?.id || leadId
        console.log(`[Enrichment] Created new Airtable record: ${airtableRecordId}`)
      }
    } catch (err) {
      console.warn(`[Enrichment] Could not resolve Airtable record ID, using original leadId: ${err}`)
    }

    const socialLinks = await fetchGeckoTerminalSocialLinks(contractAddress, chain)

    const context: EnrichmentContext = {
      leadId: airtableRecordId,
      projectName,
      contractAddress,
      chain,
      currentStep: 'awaiting_group_join',
      socialLinks,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }

    setCachedContext(context)

    // Save to Airtable for persistence
    try {
      await airtableClient.updateLead(airtableRecordId, {
        social_links_json: JSON.stringify(socialLinks),
        enrichment_step: 'awaiting_group_join',
      })
    } catch (err) {
      console.warn(`[Enrichment] Failed to save to Airtable:`, err)
    }

    return context
  } catch (error: any) {
    console.error(`[Enrichment] Social links fetch failed:`, error.message)
    throw error
  }
}

// ─── STEP 2: NOTIFY HITL TO JOIN GROUP/FOLLOW X ──────────────────────────────

export async function formatGroupJoinRequest(
  context: EnrichmentContext,
  _telegramChatId: string
): Promise<string> {
  const links = context.socialLinks || {}
  const socialText = formatSocialLinksForTelegram(links)

  const message = [
    `*🔗 Lead Enrichment: ${context.projectName}*`,
    ``,
    `Please join their community and follow their socials to gather target audience intel:`,
    ``,
    socialText,
    ``,
    `After joining, click "✅ Confirm Joined" to proceed with audience filtering.`,
    ``,
    `*Why?* We'll scan the Telegram group to identify high-value community members (founders, KOLs, devs) for outreach.`,
  ].join('\n')

  return message
}

// ─── STEP 3: UPDATE ENRICHMENT STATE ─────────────────────────────────────────

export async function updateEnrichmentStep(
  leadId: string,
  newStep: EnrichmentStep,
  additionalData?: Record<string, any>
): Promise<EnrichmentContext | null> {
  const context = getCachedContext(leadId)
  if (!context) {
    console.warn(`[Enrichment] Context not found for ${leadId}`)
    return null
  }

  const updated = {
    ...context,
    currentStep: newStep,
    ...additionalData,
  }

  setCachedContext(updated)

  // Save to Airtable
  try {
    const updateData: Record<string, any> = {
      enrichment_step: newStep,
    }
    if (additionalData?.targetAudience) {
      updateData.target_audience_json = JSON.stringify(additionalData.targetAudience)
    }
    if (additionalData?.outreachDraft) {
      updateData.outreach_draft = additionalData.outreachDraft
    }
    if (additionalData?.onboardingDraft) {
      updateData.onboarding_draft = additionalData.onboardingDraft
    }

    await airtableClient.updateLead(leadId, updateData)
  } catch (err) {
    console.warn(`[Enrichment] Failed to update Airtable:`, err)
  }

  return updated
}

// ─── STEP 4: HANDLE HITL RESPONSES ──────────────────────────────────────────

export async function handleHITLGroupConfirmation(
  leadId: string,
  groupId: string | number
): Promise<EnrichmentContext | null> {
  console.log(`[Enrichment] HITL confirmed joined group: ${groupId}`)

  return updateEnrichmentStep(leadId, 'running_profile_filter', {
    groupId,
  })
}

export async function handleHITLDraftApproval(
  leadId: string,
  approved: boolean
): Promise<EnrichmentContext | null> {
  console.log(`[Enrichment] HITL approval: ${approved ? 'approved' : 'rejected'}`)

  return updateEnrichmentStep(leadId, approved ? 'completed' : 'skipped', {
    hitlApproved: approved,
  })
}

// ─── STEP 5: INCREMENT REMINDER COUNT ────────────────────────────────────────

export async function incrementReminders(leadId: string): Promise<EnrichmentContext | null> {
  const context = getCachedContext(leadId)
  if (!context) return null

  const reminders = (context.reminders || 0) + 1
  return updateEnrichmentStep(leadId, context.currentStep, { reminders })
}

// ─── HELPER: Get enrichment summary for logging ──────────────────────────────

export function getEnrichmentSummary(context: EnrichmentContext): string {
  return [
    `Lead: ${context.projectName}`,
    `Step: ${context.currentStep}`,
    `Duration: ${Math.round((context.updatedAt - context.startedAt) / 1000)}s`,
    `Reminders: ${context.reminders || 0}`,
    `Approved: ${context.hitlApproved ? 'yes' : 'pending'}`,
  ].join(' | ')
}

// ─── EXPORT CACHE FOR TESTING ───────────────────────────────────────────────

export function getCacheStats(): {
  total: number
  byStep: Record<string, number>
} {
  const byStep: Record<string, number> = {}
  for (const context of enrichmentCache.values()) {
    byStep[context.currentStep] = (byStep[context.currentStep] || 0) + 1
  }

  return {
    total: enrichmentCache.size,
    byStep,
  }
}

export function clearCache(): void {
  enrichmentCache.clear()
}
