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
    const { enrichWithSocialLinks, formatGroupJoinRequest } = await import('../../src/lib/autonomy/lead-enrichment-handler')
    const { sendGroupJoinRequest } = await import('../../src/lib/autonomy/telegram-client')

    const context = await enrichWithSocialLinks(
      leadId,
      projectName || leadId,
      contractAddress || '',
      chain || '',
      ticker || '',
    )

    const telegramChatId = process.env.TELEGRAM_CHAT_ID || ''
    if (!telegramChatId) {
      console.warn('[Handoff] TELEGRAM_CHAT_ID not set — skipping notification')
    } else {
      const groupRequestMessage = await formatGroupJoinRequest(context, telegramChatId)
      const result = await sendGroupJoinRequest(leadId, context.projectName, groupRequestMessage)
      if (!result.ok) {
        console.error(`[Handoff] Telegram send failed: ${result.error}`)
      } else {
        console.log(`[Handoff] Telegram sent (messageId: ${result.messageId})`)
      }
    }

    return res.status(200).json({
      ok: true,
      data: {
        message: `Lead "${context.projectName}" handed off${telegramChatId ? '. HITL notified on Telegram' : ''}.`,
        projectName: context.projectName,
        step: context.currentStep,
      },
    })
  } catch (error: any) {
    console.error('[Handoff] Error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Handoff failed' })
  }
}
