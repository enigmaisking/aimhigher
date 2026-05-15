// =============================================================================
// AUTONOMY LAYER — Telegram Webhook Receiver
// =============================================================================
// Handles:
//   1. Callback queries (inline button clicks) → HITL approve/skip/discard
//   2. Text messages → match to leads, fire REPLY_RECEIVED events
//   3. /start command → bot introduction
//
// Setup:
//   1. Set TELEGRAM_BOT_TOKEN in .env.local
//   2. Run: curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-site.com/api/webhooks/telegram

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body

    // ─── Callback Query (inline button click) ─────────────────────────────
    if (body.callback_query) {
      const cb = body.callback_query
      const data = cb.data || ''

      console.log(`[Telegram Webhook] Callback: ${data} from user ${cb.from?.id}`)

      // Import orchestrator dynamically to avoid circular deps
      const { handleHITLCallback } = await import('../../../src/lib/autonomy/orchestrator')

      const result = await handleHITLCallback(data)

      // Answer callback (removes loading spinner on button)
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cb.id,
            text: result.responseText || 'Processed',
            show_alert: false,
          }),
        })
      }

      return res.status(200).json({ ok: true })
    }

    // ─── Regular Message ──────────────────────────────────────────────────
    const message = body.message
    if (!message) {
      return res.status(200).json({ ok: true })
    }

    const chatId = message.chat?.id
    const text = message.text || message.caption || ''

    if (!chatId || !text) {
      return res.status(200).json({ ok: true })
    }

    // Handle /start command
    if (text.startsWith('/start')) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              '👋 *AimHigher Autonomy Bot* active.\n\n'
              + 'New leads from Scout scans will appear here for review.\n'
              + 'Use the inline buttons to approve, skip, or discard each lead.\n\n'
              + 'Alerts: premium leads, DM failures, manual intervention requests.',
            parse_mode: 'Markdown',
          }),
        })
      }
      return res.status(200).json({ ok: true })
    }

    // Check if this is from the team chat
    const teamChatId = process.env.TELEGRAM_CHAT_ID
    if (teamChatId && String(chatId) === teamChatId) {
      // Q&A: "? your question" answers using the QA handler
      if (text.startsWith('? ')) {
        const question = text.slice(2).trim()
        if (question) {
          const { getCacheStats } = await import('../../../src/lib/autonomy/lead-enrichment-handler')
          const { answerLeadQuestion } = await import('../../../src/lib/autonomy/qa-handler')
          const stats = getCacheStats()
          const leadIds = Object.keys(stats.byStep)
          if (leadIds.length > 0) {
            const lastLeadId = leadIds[0]
            const { getCachedContext } = await import('../../../src/lib/autonomy/lead-enrichment-handler')
            const context = getCachedContext(lastLeadId)
            if (context) {
              const answer = await answerLeadQuestion({
                leadId: lastLeadId,
                projectName: context.projectName,
                painPoint: (context as any).painPoint || '',
              }, question)
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `*Q&A for ${context.projectName}:*\n\n${answer}`,
                  parse_mode: 'Markdown',
                }),
              })
            }
          }
        }
      }
      // Ignore other messages from the team chat
      return res.status(200).json({ ok: true })
    }

    // This could be a reply from a lead — fire REPLY_RECEIVED
    console.log(`[Telegram Webhook] Message from @${message.from?.username} (${message.from?.id}): ${text.slice(0, 100)}`)

    // Try to match sender to a lead in Airtable or cache
    const { handleEvent } = await import('../../../src/lib/autonomy/orchestrator')
    const { airtableClient } = await import('../../../src/lib/airtable-client')

    const username = message.from?.username
    const fromId = message.from?.id

    // Look up lead by Telegram handle in Airtable
    let matchedLeadId: string | null = null
    try {
      const leads = await airtableClient.getLeads()
      for (const record of leads) {
        const handle = record.fields.contact_handle || ''
        if (
          (username && handle.toLowerCase() === `@${username.toLowerCase()}`) ||
          (fromId && handle.includes(String(fromId)))
        ) {
          matchedLeadId = record.id
          break
        }
      }
    } catch {
      console.warn('[Telegram Webhook] Could not search Airtable for lead match')
    }

    if (matchedLeadId) {
      await handleEvent({
        type: 'REPLY_RECEIVED',
        leadId: matchedLeadId,
        timestamp: Date.now(),
        payload: {
          text,
          platform: 'telegram',
          senderId: fromId,
          username,
          chatId,
        },
      })
    } else {
      // Unknown sender — log but don't spam
      console.log(`[Telegram Webhook] No lead match for @${username} (${fromId})`)
    }

    return res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error('[Telegram Webhook] Error:', error)
    return res.status(200).json({ ok: true })
  }
}
