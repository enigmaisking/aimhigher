// =============================================================================
// AUTONOMY LAYER — X/Twitter API Client
// =============================================================================
// Sends DMs and posts via X API v2.
// TODO: Fill in your Bearer Token and API keys in .env.local
//
// Required .env.local vars:
//   X_API_KEY=           ── from https://developer.twitter.com
//   X_API_SECRET=        ── from developer portal
//   X_ACCESS_TOKEN=      ── from developer portal
//   X_ACCESS_SECRET=     ── from developer portal
//   X_BEARER_TOKEN=      ── from developer portal

interface XCredentials {
  bearerToken: string
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

function getCredentials(): XCredentials | null {
  const bearerToken = process.env.X_BEARER_TOKEN
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessSecret = process.env.X_ACCESS_SECRET

  if (!bearerToken || !apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn('[X Client] Missing credentials — set X_* env vars')
    return null
  }
  return { bearerToken, apiKey, apiSecret, accessToken, accessSecret }
}

export async function sendDirectMessage(
  recipientId: string,
  text: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const creds = getCredentials()
  if (!creds) return { ok: false, error: 'X credentials not configured' }

  try {
    // POST /2/dm_conversations/with/:participant_id/messages
    const url = `https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { ok: false, error: `X API error ${response.status}: ${errBody}` }
    }

    const data = await response.json()
    return { ok: true, messageId: data.data?.id }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export async function sendReply(
  tweetId: string,
  text: string
): Promise<{ ok: boolean; tweetId?: string; error?: string }> {
  const creds = getCredentials()
  if (!creds) return { ok: false, error: 'X credentials not configured' }

  try {
    const url = 'https://api.twitter.com/2/tweets'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { ok: false, error: `X API error ${response.status}: ${errBody}` }
    }

    const data = await response.json()
    return { ok: true, tweetId: data.data?.id }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export async function lookupUserByHandle(
  handle: string
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const creds = getCredentials()
  if (!creds) return { ok: false, error: 'X credentials not configured' }

  try {
    const url = `https://api.twitter.com/2/users/by/username/${handle.replace('@', '')}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.bearerToken}` },
    })

    if (!response.ok) {
      return { ok: false, error: `X API error ${response.status}` }
    }

    const data = await response.json()
    return { ok: true, userId: data.data?.id }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}
