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

interface ScanSession {
  chatId: number | string
  leads: any[]
  page: number
  pageSize: number
  totalPages: number
  leadMessageIds: number[]
  navMessageId: number | null
}

// In-memory cache for scan results (lost on cold boot)
const scanLeadCache = new Map<string, any>()

const SCAN_CHAINS: Record<string, string[]> = {
  all: ['solana', 'base', 'bsc', 'arbitrum', 'eth'],
  evm: ['base', 'bsc', 'arbitrum', 'eth'],
  solana: ['solana'],
}

function getAppUrl(host?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || (host ? `https://${host}` : 'https://aimhigher-one.vercel.app')
}

async function handleHandoff(leadId: string, chatId: number | string, botToken: string, host?: string) {
  const lead = scanLeadCache.get(leadId)
  if (!lead) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '❌ Lead data not found in cache. Run /scan again.', parse_mode: 'Markdown' }),
    })
    return
  }

  const appUrl = getAppUrl(host)
  const handoffRes = await fetch(`${appUrl}/api/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: lead.id,
      projectName: lead.name,
      ticker: lead.ticker?.replace('$', ''),
      contractAddress: lead.tokenAddress || '',
      chain: lead.chain,
      userChatId: chatId,
      socialLinks: {
        twitter: lead.twitterHandle || null,
        telegram: lead.telegramHandle || null,
        website: lead.websiteUrl || null,
        discord: lead.discordUrl || null,
      },
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

function formatSocialLink(label: string, handle: string | null): string | null {
  if (!handle) return null
  if (label === 'X') return `🐦 [X](${handle.startsWith('http') ? handle : `https://twitter.com/${handle}`})`
  if (label === 'Telegram') return `✈️ [Telegram](${handle.startsWith('http') ? handle : `https://t.me/${handle}`})`
  if (label === 'Website') return `🌐 [Website](${handle.startsWith('http') ? handle : `https://${handle}`})`
  if (label === 'Discord') return `💬 [Discord](${handle.startsWith('http') ? handle : `https://discord.gg/${handle}`})`
  return null
}

function formatLeadMessage(lead: any): string {
  const socialLinks = [
    formatSocialLink('X', lead.twitterHandle),
    formatSocialLink('Telegram', lead.telegramHandle),
    formatSocialLink('Website', lead.websiteUrl),
    formatSocialLink('Discord', lead.discordUrl),
  ].filter(Boolean).join(' · ')

  return [
    `*${lead.name}* (${lead.ticker})`,
    `Chain: ${lead.chain} · Score: ${lead.score}/10`,
    `Mcap: ${lead.mcap}`,
    socialLinks || '',
    `Contract: \`${lead.tokenAddress || 'N/A'}\``,
  ].filter(Boolean).join('\n')
}

async function sendLeadsPage(session: ScanSession, botToken: string) {
  const { chatId, leads, page, pageSize, totalPages } = session
  const start = page * pageSize
  const pageLeads = leads.slice(start, start + pageSize)

  // Delete previous lead messages
  for (const msgId of session.leadMessageIds) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: msgId }),
      })
    } catch { /* ignore */ }
  }
  session.leadMessageIds = []

  // Delete previous nav message
  if (session.navMessageId) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: session.navMessageId }),
      })
    } catch { /* ignore */ }
    session.navMessageId = null
  }

  // Send lead messages for current page
  for (const lead of pageLeads) {
    const msg = formatLeadMessage(lead)
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
    const json = await res.json()
    if (json.ok && json.result?.message_id) {
      session.leadMessageIds.push(json.result.message_id)
    }
  }

  // Build navigation buttons
  const row: any[] = []
  if (page > 0) {
    row.push({ text: '◀️ Previous', callback_data: `scanpage_prev` })
  }
  row.push({ text: `📄 Page ${page + 1}/${totalPages}`, callback_data: 'scanpage_info' })
  if (page < totalPages - 1) {
    row.push({ text: 'Next ▶️', callback_data: `scanpage_next` })
  }

  const navRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ Found ${leads.length} leads total.`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [row] },
    }),
  })
  const navJson = await navRes.json()
  if (navJson.ok && navJson.result?.message_id) {
    session.navMessageId = navJson.result.message_id
  }
}

async function runScan(chatId: number | string, preset: string, botToken: string, host?: string) {
  const chains = SCAN_CHAINS[preset] || SCAN_CHAINS.all
  const appUrl = getAppUrl(host)

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

    if (leads.length === 0) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: 'No qualifying leads found with current criteria.', parse_mode: 'Markdown' }),
      })
      return
    }

    // Cache all leads for handoff and pagination
    for (const lead of leads) {
      scanLeadCache.set(lead.id, lead)
    }

    const pageSize = 5
    const totalPages = Math.ceil(leads.length / pageSize)
    const session: ScanSession = {
      chatId,
      leads,
      page: 0,
      pageSize,
      totalPages,
      leadMessageIds: [],
      navMessageId: null,
    }

    // Store session in cache (keyed by chatId so callbacks can find it)
    scanLeadCache.set(`_scan_${chatId}`, session)

    await sendLeadsPage(session, botToken)
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
        await runScan(cb.message?.chat?.id || cb.from?.id, preset, botToken, req.headers.host)
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
        // Always use the user who clicked the button (cb.from?.id), not the message chat
        const chatId = cb.from?.id
        await handleHandoff(leadId, chatId, botToken, req.headers.host)
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id, text: 'Outreach started!', show_alert: false }),
          })
        }
        return res.status(200).json({ ok: true })
      }

      // Handle scan pagination (next/prev page)
      if ((data === 'scanpage_next' || data === 'scanpage_prev') && botToken) {
        const chatId = cb.message?.chat?.id || cb.from?.id
        const sessionKey = `_scan_${chatId}`
        const session: ScanSession | undefined = scanLeadCache.get(sessionKey)
        if (session) {
          if (data === 'scanpage_next' && session.page < session.totalPages - 1) {
            session.page++
          } else if (data === 'scanpage_prev' && session.page > 0) {
            session.page--
          }
          scanLeadCache.set(sessionKey, session)
          await sendLeadsPage(session, botToken)
        }
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cb.id, text: 'Loading...', show_alert: false }),
        })
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
