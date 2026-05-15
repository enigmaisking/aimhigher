// =============================================================================
// AUTONOMY LAYER — Telegram Bot API Client
// =============================================================================
// Sends messages via Telegram Bot API.
// TODO: Fill in your Bot Token in .env.local
//
// Required .env.local vars:
//   TELEGRAM_BOT_TOKEN=  ── from @BotFather on Telegram
//   TELEGRAM_CHAT_ID=    ── your team's chat/group ID for notifications

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: { parse_mode?: 'HTML' | 'Markdown'; reply_to_message_id?: number }
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  try {
    const response = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parse_mode || 'Markdown',
        reply_to_message_id: options?.reply_to_message_id,
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      return { ok: false, error: `Telegram API error: ${data.description}` }
    }
    return { ok: true, messageId: data.result?.message_id }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export async function sendTeamNotification(text: string): Promise<{ ok: boolean; error?: string }> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    return { ok: false, error: 'TELEGRAM_CHAT_ID not configured' }
  }
  return sendMessage(chatId, text, { parse_mode: 'HTML' })
}

export async function setWebhook(url: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  try {
    const response = await fetch(`${API_BASE}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await response.json()
    return data.ok === true
  } catch {
    return false
  }
}

// ─── ENRICHMENT WORKFLOW MESSAGES ──────────────────────────────────────────

export interface InlineButton {
  text: string
  callback_data: string
}

export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: InlineButton[][]
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  try {
    const body: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }

    if (buttons.length > 0) {
      body.reply_markup = { inline_keyboard: buttons }
    }

    const response = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!data.ok) {
      return { ok: false, error: `Telegram API error: ${data.description}` }
    }
    return { ok: true, messageId: data.result?.message_id }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export async function sendTeamMessageWithButtons(
  text: string,
  buttons: InlineButton[][]
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    return { ok: false, error: 'TELEGRAM_CHAT_ID not configured' }
  }
  return sendMessageWithButtons(chatId, text, buttons)
}

/**
 * Send enrichment workflow step 2: Request HITL to join group and follow X
 */
export async function sendGroupJoinRequest(
  leadId: string,
  _projectName: string,
  message: string
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const buttons: InlineButton[][] = [
    [
      {
        text: '✅ Confirmed Joined',
        callback_data: `enrich_group_confirmed_${leadId}`,
      },
      {
        text: '⏭️ Skip',
        callback_data: `enrich_skip_${leadId}`,
      },
    ],
  ]

  return sendTeamMessageWithButtons(message, buttons)
}

/**
 * Send enrichment workflow step 4: Request HITL to review and approve draft
 */
export async function sendDraftForApproval(
  leadId: string,
  projectName: string,
  outreachDraft: string,
  socialLinks?: { twitter?: string | null; telegram?: string | null; discord?: string | null; website?: string | null }
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const links = socialLinks || {}
  const linkLines: string[] = []
  if (links.twitter) linkLines.push(`🐦 [X/Twitter](${links.twitter})`)
  if (links.discord) linkLines.push(`💬 [Discord](${links.discord})`)
  if (links.website) linkLines.push(`🌐 [Website](${links.website})`)
  if (links.telegram) linkLines.push(`✈️ [Telegram](${links.telegram})`)

  const linksSection = linkLines.length > 0
    ? `\n*🔗 Project Links:*\n${linkLines.join('\n')}\n`
    : ''

  const message = [
    `*✏️ Outreach Draft for ${projectName}*`,
    linksSection,
    `*📝 Message:*`,
    `\`\`\``,
    outreachDraft,
    `\`\`\``,
    ``,
    `Review and approve to send, or click Edit to regenerate.`,
  ].join('\n')

  const buttons: InlineButton[][] = [
    [
      {
        text: '✅ Approve & Send',
        callback_data: `enrich_draft_approve_${leadId}`,
      },
      {
        text: '✏️ Edit Draft',
        callback_data: `enrich_draft_edit_${leadId}`,
      },
    ],
    [
      {
        text: '⏭️ Skip Lead',
        callback_data: `enrich_skip_${leadId}`,
      },
    ],
  ]

  return sendTeamMessageWithButtons(message, buttons)
}

/**
 * Send reminder if HITL hasn't completed enrichment step
 */
export async function sendEnrichmentReminder(
  leadId: string,
  projectName: string,
  currentStep: string,
  reminderCount: number
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const steps: Record<string, string> = {
    awaiting_group_join: 'join the project group and follow their X account',
    running_profile_filter: 'confirm the audience profile analysis',
    generating_draft: 'wait for draft generation',
    awaiting_approval: 'review and approve the outreach draft',
  }

  const stepDescription = steps[currentStep] || 'complete the enrichment'
  const message = `
⏰ *Reminder: ${projectName}*

You still need to ${stepDescription}.

This is reminder #${reminderCount} for this lead.
`.trim()

  const buttons: InlineButton[][] = [
    [
      {
        text: '👀 Review Now',
        callback_data: `enrich_review_${leadId}`,
      },
      {
        text: '⏭️ Skip',
        callback_data: `enrich_skip_${leadId}`,
      },
    ],
  ]

  return sendTeamMessageWithButtons(message, buttons)
}

/**
 * Send confirmation when enrichment completes
 */
export async function sendEnrichmentComplete(
  projectName: string,
  targetAudienceCount: number,
  profileTags: string[]
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const message = [
    `✅ *Enrichment Complete: ${projectName}*`,
    ``,
    `📊 *Target Audience:* ${targetAudienceCount} high-value members identified`,
    `🏷️ *Tags:* ${profileTags.join(', ')}`,
    ``,
    `The outreach draft has been generated and is ready for your review.`,
  ].join('\n')

  return sendTeamNotification(message)
}
