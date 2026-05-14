// =============================================================================
// AUTONOMY LAYER — Discord Interactions Webhook Receiver
// =============================================================================
// Handles Discord slash commands and button interactions.
// Fires events into the orchestrator for lead management.
//
// TODO: Set up Discord Interactions Endpoint URL:
//   Discord Developer Portal → App → General → Interactions Endpoint URL
//   URL: https://your-site.com/api/webhooks/discord
//
// Required .env.local:
//   DISCORD_PUBLIC_KEY=  ── from Discord Developer Portal → App → General

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body

    // ─── Discord sends a PING to verify endpoint ────────────────────────────
    if (body.type === 1) {
      return res.status(200).json({ type: 1 })
    }

    // ─── Slash command ──────────────────────────────────────────────────────
    if (body.type === 2) {
      const command = body.data?.name

      console.log(`[Discord Webhook] Command: /${command} by ${body.member?.user?.id}`)

      switch (command) {
        case 'leads':
        case 'scan':
        case 'status':
          // TODO: implement Discord slash command handlers
          break
        default:
          return res.status(200).json({
            type: 4,
            data: { content: `Unknown command: /${command}` },
          })
      }
    }

    // ─── Button interaction ──────────────────────────────────────────────────
    if (body.type === 3) {
      const customId = body.data?.custom_id
      console.log(`[Discord Webhook] Button: ${customId}`)
      // TODO: handle button clicks (approve lead, dismiss, etc.)
    }

    return res.status(200).json({ type: 4, data: { content: 'Acknowledged' } })
  } catch (error: any) {
    console.error('[Discord Webhook] Error:', error)
    return res.status(200).json({ type: 4, data: { content: 'Error processing request' } })
  }
}
