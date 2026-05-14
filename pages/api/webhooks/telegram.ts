// =============================================================================
// AUTONOMY LAYER — Telegram Webhook Receiver
// =============================================================================
// Listens for Telegram replies from leads.
// Fires REPLY_RECEIVED events into the orchestrator.
//
// Setup:
//   1. Set TELEGRAM_BOT_TOKEN in .env.local
//   2. Run: curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-site.com/api/webhooks/telegram
//   3. Or use the setWebhook() helper in telegram-client.ts

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body

    // ─── Telegram sends update objects ──────────────────────────────────────
    const message = body.message
    if (!message) {
      return res.status(200).json({ ok: true }) // Acknowledge non-message events
    }

    const chatId = message.chat?.id
    const text = message.text || message.caption || ''
    const fromId = message.from?.id
    const username = message.from?.username

    if (!chatId || !text) {
      return res.status(200).json({ ok: true })
    }

    console.log(`[Telegram Webhook] From @${username} (${fromId}): ${text.slice(0, 100)}`)

    // TODO: Match chatId/username to a lead in your data store
    // const lead = await findLeadByTelegram(chatId, username)
    // if (lead) {
    //   const { handleEvent } = await import('../../src/lib/autonomy/orchestrator')
    //   await handleEvent({
    //     type: 'REPLY_RECEIVED',
    //     leadId: lead.id,
    //     timestamp: Date.now(),
    //     payload: { text, chatId, platform: 'telegram' },
    //   })
    // }

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('[Telegram Webhook] Error:', error)
    return res.status(200).json({ ok: true }) // Always ack Telegram
  }
}
