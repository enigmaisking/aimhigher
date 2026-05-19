import type { NextApiRequest, NextApiResponse } from 'next'

interface TargetIndividual {
  name: string
  role: 'founder' | 'kol' | 'dev' | 'admin' | 'community_lead' | 'alpha' | 'influencer'
  handle?: string
  notes?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { leadId, projectName, ticker, contractAddress, chain, targetIndividuals, socialLinks, userChatId } = req.body as {
    leadId: string
    projectName?: string
    ticker?: string
    contractAddress?: string
    chain?: string
    targetIndividuals?: TargetIndividual[]
    socialLinks?: { twitter?: string | null; telegram?: string | null; website?: string | null; discord?: string | null }
    userChatId?: string | number
  }

  if (!leadId) {
    return res.status(400).json({ ok: false, error: 'leadId is required' })
  }

  try {
    const { enrichWithSocialLinks, formatGroupJoinRequest, updateEnrichmentStep } = await import('../../src/lib/autonomy/lead-enrichment-handler')
    const { sendGroupJoinRequest, sendDraftForApproval } = await import('../../src/lib/autonomy/telegram-client')
    const { generateFullDraft } = await import('../../src/lib/autonomy/draft-generator')

    const context = await enrichWithSocialLinks(
      leadId,
      projectName || leadId,
      contractAddress || '',
      chain || '',
      ticker || '',
      socialLinks,
    )

    // Ensure social links from scan data are used even if enrichWithSocialLinks
    // had to fall back to API fetch (which may return empty results)
    const mergedLinks = { ...(context.socialLinks || {}) }
    if (socialLinks) {
      if (socialLinks.twitter && !mergedLinks.twitter) mergedLinks.twitter = socialLinks.twitter
      if (socialLinks.telegram && !mergedLinks.telegram) mergedLinks.telegram = socialLinks.telegram
      if (socialLinks.website && !mergedLinks.website) mergedLinks.website = socialLinks.website
      if (socialLinks.discord && !mergedLinks.discord) mergedLinks.discord = socialLinks.discord
    }
    context.socialLinks = mergedLinks

    const telegramChatId = process.env.TELEGRAM_CHAT_ID || ''
    const hasTelegram = !!(context.socialLinks?.telegram)

    // Derive target audience info from provided individuals or enrichment context
    const targetTags = (targetIndividuals || []).map((t) => {
      const roleToTag: Record<string, string> = {
        founder: 'FOUNDER',
        kol: 'KOL',
        dev: 'DEV',
        admin: 'ADMIN',
        community_lead: 'COMMUNITY_LEAD',
        alpha: 'ALPHA',
        influencer: 'INFLUENCER',
      }
      return roleToTag[t.role] || 'COMMUNITY_LEAD'
    })

    if (hasTelegram && telegramChatId) {
      // Normal path: has Telegram → ask HITL to join group
      const groupRequestMessage = await formatGroupJoinRequest(context, telegramChatId)
      const result = await sendGroupJoinRequest(leadId, context.projectName, groupRequestMessage)
      if (!result.ok) {
        console.error(`[Handoff] Telegram send failed: ${result.error}`)
      } else {
        console.log(`[Handoff] Group join request sent (messageId: ${result.messageId})`)
      }

      return res.status(200).json({
        ok: true,
        data: {
          message: `Lead "${context.projectName}" handed off. HITL notified to join Telegram group.`,
          projectName: context.projectName,
          step: context.currentStep,
        },
      })
    }

    // No Telegram link — generate draft directly
    // If known founders/KOLs were provided as target individuals, 
    // include them in the draft so outreach targets their specific role
    const hasOtherSocials = !!(context.socialLinks?.twitter || context.socialLinks?.website || context.socialLinks?.discord)
    console.log(`[Handoff] No Telegram link — generating draft${targetIndividuals?.length ? ` for ${targetIndividuals.length} known individuals` : ''}`)
    await updateEnrichmentStep(leadId, 'generating_draft')

    const draftInput = {
      projectName: context.projectName,
      chain: context.chain,
      painPoint: (context as any)?.painPoint || '',
      hook: (context as any)?.hook || '',
      verdict: 'LEAD',
      targetAudienceTags: targetTags.length > 0 ? targetTags : [],
      targetAudienceCount: targetIndividuals?.length || 0,
      tokenTicker: ticker || '',
      estimatedMcap: '',
    }

    const fullDraft = await generateFullDraft(leadId, draftInput)
    await sendDraftForApproval(leadId, context.projectName, fullDraft.outreach, context.socialLinks, hasTelegram, userChatId)

    console.log(`[Handoff] Draft sent for approval: ${context.projectName}`)

    const noSocialMsg = hasOtherSocials
      ? `Lead "${context.projectName}" has no Telegram link. Draft generated for outreach via other channels.`
      : targetIndividuals?.length
        ? `Lead "${context.projectName}" has no social links. Draft generated targeting ${targetIndividuals.length} known individual(s) for manual outreach.`
        : `Lead "${context.projectName}" has no social links. No target individuals provided — basic draft sent for review. Add known founders/KOLs to personalize outreach.`

    return res.status(200).json({
      ok: true,
      data: {
        message: noSocialMsg,
        projectName: context.projectName,
        step: 'awaiting_approval',
        targetCount: targetIndividuals?.length || 0,
      },
    })
  } catch (error: any) {
    console.error('[Handoff] Error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Handoff failed' })
  }
}
