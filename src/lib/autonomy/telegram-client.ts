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
