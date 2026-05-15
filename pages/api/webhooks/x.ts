// =============================================================================
// AUTONOMY LAYER — X/Twitter Webhook Receiver
// =============================================================================
// Handles:
//   1. CRC (Challenge-Response Check) — HMAC-SHA256 verification
//   2. DM events — parse incoming DMs, fire REPLY_RECEIVED into orchestrator
//
// Setup:
//   Register this webhook in X Developer Portal:
//   Dashboard → Project → User authentication settings → Webhook
//   URL: https://your-site.com/api/webhooks/x
//
// Required .env.local:
//   X_WEBHOOK_SECRET=  ── random string, used to verify webhook requests

import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.X_WEBHOOK_SECRET || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── CRC (Challenge-Response Check) ────────────────────────────────────
  // X sends a GET with ?crc_token=... to verify ownership of this webhook URL.
  // We must respond with HMAC-SHA256(response_token) using X_WEBHOOK_SECRET.
  if (req.method === 'GET') {
    const crcToken = req.query.crc_token as string
    if (!crcToken) {
      return res.status(400).json({ error: 'Missing crc_token' })
    }

    try {
      const hmac = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(crcToken)
        .digest('base64')

      console.log(`[X Webhook] CRC verified for token: ${crcToken.slice(0, 20)}...`)
      return res.status(200).json({ response_token: `sha256=${hmac}` })
    } catch (error: any) {
      console.error('[X Webhook] CRC generation failed:', error.message)
      return res.status(500).json({ error: 'CRC generation failed' })
    }
  }

  // ─── Incoming DM or mention ─────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body

      // Parse DM events
      const dmEvents = body.direct_message_events || []
      const users = body.users || {}

      if (dmEvents.length === 0) {
        console.log('[X Webhook] No DM events in payload')
        return res.status(200).json({ ok: true })
      }

      for (const event of dmEvents) {
        // Only process message_create events
        if (event.type !== 'message_create') continue

        const msg = event.message_create
        if (!msg) continue

        const senderId = msg.sender_id
        const text = msg.message_data?.text || ''

        // Skip messages WE sent (they come from our own bot account)
        const botUserId = body.for_user_id
        if (senderId === botUserId) continue

        console.log(`[X Webhook] DM from user ${senderId}: ${text.slice(0, 100)}`)

        // Look up sender info
        const sender = users[senderId]
        const senderHandle = sender?.screen_name || senderId

        // Try to find a matching lead by X handle
        const { handleEvent } = await import('../../../src/lib/autonomy/orchestrator')
        const { airtableClient } = await import('../../../src/lib/airtable-client')

        let matchedLeadId: string | null = null
        try {
          const leads = await airtableClient.getLeads()
          for (const record of leads) {
            const handle = (record.fields.contact_handle || '').toLowerCase()
            if (handle === `@${senderHandle.toLowerCase()}` || handle.includes(senderId)) {
              matchedLeadId = record.id
              break
            }
          }
        } catch {
          console.warn('[X Webhook] Could not search Airtable for lead match')
        }

        if (matchedLeadId) {
          await handleEvent({
            type: 'REPLY_RECEIVED',
            leadId: matchedLeadId,
            timestamp: Date.now(),
            payload: {
              text,
              platform: 'x',
              senderId,
              senderHandle,
            },
          })
        } else {
          console.log(`[X Webhook] No lead match for @${senderHandle} (${senderId})`)
        }
      }

      return res.status(200).json({ ok: true })
    } catch (error: any) {
      console.error('[X Webhook] Error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
