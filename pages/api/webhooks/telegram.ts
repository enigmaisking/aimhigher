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

// In-memory cache for scan results (lost on cold boot)
const scanLeadCache = new Map<string, any>()

const SCAN_CHAINS: Record<string, string[]> = {
  all: ['eth', 'solana', 'bsc', 'base', 'avax', 'arbitrum', 'optimism', 'polygon-pos', 'fantom'],
  evm: ['eth', 'bsc', 'base', 'avax', 'arbitrum', 'optimism', 'polygon-pos', 'fantom'],
  solana: ['solana'],
}

async function handleHandoff(leadId: string, chatId: number | string, botToken: string) {
  const lead = scanLeadCache.get(leadId)
  if (!lead) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '❌ Lead data not found in cache. Run /scan again.', parse_mode: 'Markdown' }),
    })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aimhigher-one.vercel.app'
  const handoffRes = await fetch(`${appUrl}/api/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: lead.id,
      projectName: lead.name,
      ticker: lead.ticker?.replace('$', ''),
      contractAddress: lead.tokenAddress || '',
      chain: lead.chain,
    }),
  })

  const json = await handoffRes.json()
  if (json.ok) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `✅ ${json.data.message}`, parse_mode: 'Markdown' }),
    })
  } else {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `❌ Handoff failed: ${json.error}`, parse_mode: 'Markdown' }),
    })
  }
}

async function runScan(chatId: number | string, preset: string, botToken: string) {
  const chains = SCAN_CHAINS[preset] || SCAN_CHAINS.all
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aimhigher-one.vercel.app'

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🔍 Scanning ${chains.length} chains (${preset})...`,
      parse_mode: 'Markdown',
    }),
  })

  try {
    const scoutRes = await fetch(`${appUrl}/api/scout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chains,
        sourceTypes: ['onchain'],
        minimumScore: 5,
        pageSize: 10,
        manualSignals: [],
      }),
    })

    if (!scoutRes.ok) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `❌ Scout API returned ${scoutRes.status}`, parse_mode: 'Markdown' }),
      })
      return
    }

    const { data } = await scoutRes.json()
    const leads = data?.leads || []
    const noSocialLeads = data?.noSocialLeads || []

    // Show regular leads
    if (leads.length > 0) {
      const topLeads = leads.slice(0, 5)
      for (const lead of topLeads) {
        scanLeadCache.set(lead.id, lead)
      }

      for (const lead of topLeads) {
        const socialLinks: string[] = []
        if (lead.twitterHandle) socialLinks.push(`🐦 [X](${lead.twitterHandle.startsWith('http') ? lead.twitterHandle : `https://twitter.com/${lead.twitterHandle}`})`)
        if (lead.telegramHandle) socialLinks.push(`✈️ [Telegram](${lead.telegramHandle.startsWith('http') ? lead.telegramHandle : `https://t.me/${lead.telegramHandle}`})`)
        if (lead.websiteUrl) socialLinks.push(`🌐 [Website](${lead.websiteUrl.startsWith('http') ? lead.websiteUrl : `https://${lead.websiteUrl}`})`)
        if (lead.discordUrl) socialLinks.push(`💬 [Discord](${lead.discordUrl.startsWith('http') ? lead.discordUrl : `https://discord.gg/${lead.discordUrl}`})`)

        const msg = [
          `*${lead.name}* (${lead.ticker})`,
          `Chain: ${lead.chain} · Score: ${lead.score}/10`,
          `Mcap: ${lead.mcap}`,
          socialLinks.length > 0 ? socialLinks.join(' · ') : '',
          `Contract: \`${lead.tokenAddress || 'N/A'}\``,
        ].filter(Boolean).join('\n')

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: msg,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔗 Start Outreach', callback_data: `handoff_${lead.id}` },
              ]],
            },
          }),
        })
      }

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Found ${leads.length} leads. ${leads.length > 5 ? `Showing top 5.` : ''}`,
          parse_mode: 'Markdown',
        }),
      })
      return
    }

    // No regular leads — check noSocialLeads (projects with no X/Telegram/website)
    if (noSocialLeads.length > 0) {
      const topNoSocial = noSocialLeads.slice(0, 5)
      for (const lead of topNoSocial) {
        scanLeadCache.set(lead.id, { ...lead, noSocialData: true })
      }

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ *${noSocialLeads.length} projects found with no social links.*\n\nThey can't be reached via X/Telegram/website. If you know founders or KOLs involved, provide their contacts when starting outreach.`,
          parse_mode: 'Markdown',
        }),
      })

      for (const lead of topNoSocial) {
        const msg = [
          `*${lead.name}* (${lead.ticker})`,
          `Chain: ${lead.chain} · Mcap: ${lead.mcap}`,
          `_No social links available_`,
          `Contract: \`${lead.tokenAddress || 'N/A'}\``,
        ].join('\n')

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: msg,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔗 Outreach (manual contacts)', callback_data: `handoff_${lead.id}` },
              ]],
            },
          }),
        })
      }
      return
    }

    // Absolutely nothing found
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: 'No qualifying leads found with current criteria.', parse_mode: 'Markdown' }),
    })
  } catch (err: any) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `❌ Scan error: ${err.message}`, parse_mode: 'Markdown' }),
    })
  }
}

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
      const botToken = process.env.TELEGRAM_BOT_TOKEN

      console.log(`[Telegram Webhook] Callback: ${data} from user ${cb.from?.id}`)

      // Handle scan presets
      if (data.startsWith('scan_') && botToken) {
        const preset = data.replace('scan_', '')
        await runScan(cb.message?.chat?.id || cb.from?.id, preset, botToken)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: 'Scan started!', show_alert: false }),
          })
        }
        return res.status(200).json({ ok: true })
      }

      // Handle handoff from /scan results
      if (data.startsWith('handoff_') && botToken) {
        const leadId = data.replace('handoff_', '')
        const chatId = cb.message?.chat?.id || cb.from?.id
        await handleHandoff(leadId, chatId, botToken)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: 'Outreach started!', show_alert: false }),
          })
        }
        return res.status(200).json({ ok: true })
      }

      // Import orchestrator dynamically to avoid circular deps
      const { handleHITLCallback } = await import('../../../src/lib/autonomy/orchestrator')

      const result = await handleHITLCallback(data)

      // Answer callback (removes loading spinner on button)
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
              + 'Commands:\n'
              + '/scan — Run a scout scan from here\n'
              + '/start — Show this message',
            parse_mode: 'Markdown',
          }),
        })
      }
      return res.status(200).json({ ok: true })
    }

    // Handle /scan command
    if (text.startsWith('/scan')) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '🔍 *Select scan preset:*',
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🚀 All Chains', callback_data: 'scan_all' },
                  { text: '⛓️ EVM', callback_data: 'scan_evm' },
                ],
                [
                  { text: '🌐 Solana', callback_data: 'scan_solana' },
                ],
              ],
            },
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
