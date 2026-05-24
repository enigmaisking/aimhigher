import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken) {
    return res.status(400).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set in .env.local' })
  }
  if (!chatId) {
    return res.status(400).json({ ok: false, error: 'TELEGRAM_CHAT_ID not set in .env.local' })
  }

  const results: { step: string; ok: boolean; detail?: string }[] = []

  // Step 1: Verify the bot token by calling getMe
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const meData = await meRes.json()
    if (meData.ok) {
      const bot = meData.result
      results.push({ step: 'verify_token', ok: true, detail: `Bot @${bot.username} (${bot.first_name}) verified` })
    } else {
      results.push({ step: 'verify_token', ok: false, detail: `Invalid token: ${meData.description}` })
      return res.status(200).json({ ok: false, results })
    }
  } catch (err: any) {
    results.push({ step: 'verify_token', ok: false, detail: err.message })
    return res.status(200).json({ ok: false, results })
  }

  // Step 2: Determine the public webhook URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.host ? `https://${req.headers.host}` : null)
  if (!appUrl) {
    results.push({ step: 'resolve_url', ok: false, detail: 'Cannot determine app URL. Set NEXT_PUBLIC_APP_URL in .env.local' })
    return res.status(200).json({ ok: false, results })
  }
  const webhookUrl = `${appUrl}/api/webhooks/telegram`
  results.push({ step: 'resolve_url', ok: true, detail: `Webhook URL: ${webhookUrl}` })

  // Step 3: Register the webhook with Telegram
  try {
    const whRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    const whData = await whRes.json()
    if (whData.ok) {
      results.push({ step: 'set_webhook', ok: true, detail: whData.description || 'Webhook set successfully' })
    } else {
      results.push({ step: 'set_webhook', ok: false, detail: whData.description || 'Failed to set webhook' })
      return res.status(200).json({ ok: false, results })
    }
  } catch (err: any) {
    results.push({ step: 'set_webhook', ok: false, detail: err.message })
    return res.status(200).json({ ok: false, results })
  }

  // Step 4: Get current webhook info
  try {
    const whInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const whInfoData = await whInfoRes.json()
    if (whInfoData.ok) {
      results.push({
        step: 'webhook_info',
        ok: true,
        detail: `URL: ${whInfoData.result.url} | Pending: ${whInfoData.result.pending_update_count} | Errors: ${whInfoData.result.last_error_message || 'none'}`,
      })
    }
  } catch { /* non-critical */ }

  // Step 5: Send a test message to the team chat
  try {
    const testRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ *AimHigher Bot initialized* — webhook is live and ready.',
        parse_mode: 'Markdown',
      }),
    })
    const testData = await testRes.json()
    if (testData.ok) {
      results.push({ step: 'test_message', ok: true, detail: 'Test message sent to team chat' })
    } else {
      results.push({ step: 'test_message', ok: false, detail: `Failed: ${testData.description}. Is the bot added to the group?` })
    }
  } catch (err: any) {
    results.push({ step: 'test_message', ok: false, detail: err.message })
  }

  const allOk = results.every(r => r.ok)
  return res.status(200).json({ ok: allOk, results })
}
