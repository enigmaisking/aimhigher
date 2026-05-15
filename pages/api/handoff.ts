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
    const groupRequestMessage = await formatGroupJoinRequest(context, telegramChatId)

    await sendGroupJoinRequest(leadId, context.projectName, groupRequestMessage)

    return res.status(200).json({
      ok: true,
      data: {
        message: `Lead "${context.projectName}" handed off. HITL notified on Telegram to join groups.`,
        projectName: context.projectName,
        step: context.currentStep,
      },
    })
  } catch (error: any) {
    console.error('[Handoff] Error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Handoff failed' })
  }
}
