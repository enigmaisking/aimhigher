// =============================================================================
// AUTONOMY LAYER — X/Twitter Webhook Receiver
// =============================================================================
// Listens for DM replies and mentions from leads.
// Fires REPLY_RECEIVED events into the orchestrator.
//
// TODO: Register this webhook URL in your X Developer Portal:
//   Dashboard → Project → User authentication settings → Webhook
//   URL: https://your-site.com/api/webhooks/x
//
// Required .env.local:
//   X_WEBHOOK_SECRET=  ── random string, used to verify webhook requests

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── X sends a CRC (Challenge-Response Check) ────────────────────────────
  if (req.method === 'GET') {
    const crcToken = req.query.crc_token as string
    if (crcToken) {
      // TODO: Generate HMAC-SHA256 response_token
      // const hmac = crypto.createHmac('sha256', process.env.X_WEBHOOK_SECRET!).update(crcToken).digest('base64')
      // return res.json({ response_token: `sha256=${hmac}` })
      console.log('[X Webhook] CRC received:', crcToken)
      return res.status(200).json({ response_token: 'sha256=TODO_FILL_IN_HMAC' })
    }
    return res.status(400).json({ error: 'Missing crc_token' })
  }

  // ─── Incoming DM or mention ───────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body

      // TODO: Parse X webhook payload
      // X sends: { direct_message_events: [...], users: {...} }
      // const events = body.direct_message_events || []
      // for (const event of events) {
      //   const senderId = event.message.sender_id
      //   const text = event.message.text
      //   // Find the lead by sender ID and fire REPLY_RECEIVED
      //   const { handleEvent } = await import('../../src/lib/autonomy/orchestrator')
      //   await handleEvent({
      //     type: 'REPLY_RECEIVED',
      //     leadId: 'TODO: look up by sender_id',
      //     timestamp: Date.now(),
      //     payload: { text, senderId, platform: 'x' },
      //   })
      // }

      console.log('[X Webhook] Event received:', JSON.stringify(body).slice(0, 200))
      return res.status(200).json({ ok: true })
    } catch (error: any) {
      console.error('[X Webhook] Error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
