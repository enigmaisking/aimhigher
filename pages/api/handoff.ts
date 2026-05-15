import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { leadId, projectName, ticker, contractAddress, chain } = req.body

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
    )

    const telegramChatId = process.env.TELEGRAM_CHAT_ID || ''

    // If Telegram link exists → ask HITL to join group
    // If no Telegram link → skip to draft generation using available social data
    const hasTelegram = !!(context.socialLinks?.telegram)

    if (hasTelegram && telegramChatId) {
      const groupRequestMessage = await formatGroupJoinRequest(context, telegramChatId)
      const result = await sendGroupJoinRequest(leadId, context.projectName, groupRequestMessage)
      if (!result.ok) {
        console.error(`[Handoff] Telegram send failed: ${result.error}`)
      } else {
        console.log(`[Handoff] Group join request sent (messageId: ${result.messageId})`)
      }
    } else if (!hasTelegram && telegramChatId) {
      console.log(`[Handoff] No Telegram link — generating draft directly`)
      await updateEnrichmentStep(leadId, 'generating_draft')

      const draftInput = {
        projectName: context.projectName,
        chain: context.chain,
        painPoint: '',
        hook: '',
        verdict: 'LEAD',
        targetAudienceTags: [] as string[],
        targetAudienceCount: 0,
        tokenTicker: ticker || '',
        estimatedMcap: '',
      }

      const fullDraft = await generateFullDraft(leadId, draftInput)
      await sendDraftForApproval(leadId, context.projectName, fullDraft.outreach, context.socialLinks)

      console.log(`[Handoff] Draft sent for approval: ${context.projectName}`)
    }

    return res.status(200).json({
      ok: true,
      data: {
        message: hasTelegram
          ? `Lead "${context.projectName}" handed off. HITL notified to join Telegram group.`
          : `Lead "${context.projectName}" handed off. No Telegram found — draft sent for review.`,
        projectName: context.projectName,
        step: hasTelegram ? context.currentStep : 'awaiting_approval',
      },
    })
  } catch (error: any) {
    console.error('[Handoff] Error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Handoff failed' })
  }
}
