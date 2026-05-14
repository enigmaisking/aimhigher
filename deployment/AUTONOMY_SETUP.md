# Full Autonomy Setup Guide

## Overview

This guide walks you through making AimHigher fully autonomous — scheduled scans,
automated outreach via X/Telegram/Discord, event-driven agent orchestration, and
team notifications when premium leads are found.

---

## Step 1: Environment Variables

Copy these into your `.env.local`. All marked `FILL_IN` require real credentials.

```bash
# ─── SCHEDULED SCANS ──────────────────────────────────────────────────────────
CRON_SECRET=                          # FILL_IN: random string to protect cron endpoint
SCOUT_CHAINS=eth,solana,bsc,base,avax,arbitrum,optimism,polygon-pos,fantom

# ─── X/TWITTER API (for automated DMs) ───────────────────────────────────────
# Get these from: https://developer.twitter.com → Project → Keys & Tokens
X_API_KEY=                            # FILL_IN: API Key
X_API_SECRET=                         # FILL_IN: API Secret
X_ACCESS_TOKEN=                       # FILL_IN: Access Token
X_ACCESS_SECRET=                      # FILL_IN: Access Secret
X_BEARER_TOKEN=                       # FILL_IN: Bearer Token
X_WEBHOOK_SECRET=                     # FILL_IN: for webhook verification

# ─── TELEGRAM BOT (for automated messaging + alerts) ─────────────────────────
# Get from: https://t.me/BotFather → /newbot
TELEGRAM_BOT_TOKEN=                   # FILL_IN: BotFather gives you this
TELEGRAM_CHAT_ID=                     # FILL_IN: your team chat ID (get from @userinfobot)

# ─── DISCORD WEBHOOK (for premium lead alerts) ───────────────────────────────
# Channel Settings → Integrations → Webhooks → New Webhook
DISCORD_WEBHOOK_URL=                  # FILL_IN: https://discord.com/api/webhooks/...
DISCORD_PUBLIC_KEY=                   # FILL_IN: from Discord Developer Portal

# ─── SLACK WEBHOOK (for premium lead alerts) ─────────────────────────────────
# https://api.slack.com/apps → Incoming Webhooks
SLACK_WEBHOOK_URL=                    # FILL_IN: https://hooks.slack.com/services/...

# ─── AUTONOMY CONFIG (optional overrides) ────────────────────────────────────
# Defaults: scan every 60min, handoff PREMIUM at 8.5, 48h cooldown
AUTONOMY_SCAN_INTERVAL=60
AUTONOMY_HANDOFF_THRESHOLD=8.5
AUTONOMY_COOLDOWN_HOURS=48
```

---

## Step 2: Scheduled Scans

### Option A: Vercel Cron Jobs (easiest)

Add to `vercel.json` at the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "0 * * * *"
    }
  ]
}
```

Then set `CRON_SECRET` in Vercel environment variables and call:
```bash
curl -X POST https://your-site.vercel.app/api/cron/scan \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option B: Self-hosted (systemd timer / crontab)

```bash
# Edit crontab: crontab -e
# Run every hour:
0 * * * * curl -X POST https://your-site.com/api/cron/scan -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option C: node-cron (inside the app)

```typescript
// In your server setup (pages/_app.tsx or a custom server):
import cron from 'node-cron'
cron.schedule('0 * * * *', () => {
  fetch('http://localhost:3000/api/cron/scan', {
    headers: { Authorization: 'Bearer YOUR_CRON_SECRET' }
  })
})
```

---

## Step 3: X/Twitter Integration

### 3a. Create a Twitter Developer Project
1. Go to https://developer.twitter.com
2. Create a Project → "AimHigher Outreach"
3. Enable OAuth 1.0a + OAuth 2.0
4. Generate keys → copy to `.env.local` as `X_*` vars
5. Set User Authentication settings:
   - App permissions: **Read + Write + Direct Messages**
   - Type of App: **Web App**

### 3b. Register Webhook (to receive DM replies)
1. In Developer Portal → Project → **Dev Environments**
2. Create a **Dev Environment** for webhooks
3. Register endpoint:
   ```
   POST https://api.twitter.com/2/webhooks
   Body: { url: "https://your-site.com/api/webhooks/x" }
   Auth: Bearer token with webhook scope
   ```
4. Subscribe to DM events:
   ```
   POST https://api.twitter.com/2/webhooks/:id/subscriptions
   ```

### 3c. Wire up the orchestrator (files to edit):
- `src/lib/autonomy/x-client.ts` — credentials are read from env, no changes needed
- `pages/api/webhooks/x.ts` — **FILL_IN**: implement HMAC CRC verification + DM parsing

---

## Step 4: Telegram Bot Integration

### 4a. Create a Telegram Bot
1. Open Telegram → search for `@BotFather`
2. Send `/newbot` → choose name → get token
3. Copy token to `TELEGRAM_BOT_TOKEN` in `.env.local`

### 4b. Set the webhook
```bash
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-site.com/api/webhooks/telegram
```

### 4c. Get your team chat ID
1. Add `@userinfobot` to your team chat
2. Send `/id` → copy the numeric chat ID
3. Set as `TELEGRAM_CHAT_ID` in `.env.local`

### 4d. Files to edit:
- `pages/api/webhooks/telegram.ts` — **FILL_IN**: match incoming messages to leads
- `src/lib/autonomy/orchestrator.ts` — **FILL_IN**: wire `dispatchOutreach` for Telegram

---

## Step 5: How the Autonomy Pipeline Works

Once configured, the system runs this autonomous pipeline every hour:

```
Cron /api/cron/scan
  ↓
GeckoTerminal trending_pools + new_pools (with base_token for social links)
  ↓
Scout scores & filters (mcap $30k-$5M, reserve >$2.5k)
  ↓
Orchestrator checks each lead:
  ├─ Score ≥ 8.5 (PREMIUM) → Telegram alert to team
  │                               ↓
  │                         Attempt DM on X (via @twitter_handle)
  │                         If X fails → try Telegram DM
  │                         If both fail → Telegram alert: "Manual intervention needed"
  │
  ├─ Reply received on X/Telegram webhook
  │     → If positive → advance state machine
  │     → If unclear → Telegram alert for human review
  │
  └─ Agent stuck / uncertain → Telegram alert: "Manual intervention needed"
```

### Required: Telegram Bot (for all alerts + auto-DM fallback)

Premium lead alerts, DM failure alerts, and manual intervention requests all go to **Telegram**.

1. Open Telegram → search for `@BotFather` → `/newbot`
2. Copy token to `TELEGRAM_BOT_TOKEN` in `.env.local`
3. Add `@userinfobot` to your team chat → send `/id` → copy numeric chat ID to `TELEGRAM_CHAT_ID`

### Optional: Discord Webhook (secondary alerts)
Channel Settings → Integrations → Webhooks → New Webhook → set `DISCORD_WEBHOOK_URL`

### Optional: Slack Webhook (secondary alerts)
https://api.slack.com/apps → Create New App → Incoming Webhooks → set `SLACK_WEBHOOK_URL`

### Optional: Discord Slash Commands
1. https://discord.com/developers/applications → New Application → Bot
2. Set Interactions Endpoint URL: `https://your-site.com/api/webhooks/discord`
3. Set `DISCORD_PUBLIC_KEY` in `.env.local`

---

## Step 6: Complete the Orchestrator

The critical file to finish is `src/lib/autonomy/orchestrator.ts`.

Search for `FILL_IN` markers in all autonomy files and replace with real logic:

| File | What to fill in |
|------|----------------|
| `orchestrator.ts` | Lead lookup from Airtable, Groq intent parsing, state transitions |
| `x-client.ts` | Already reads env vars — works once you set them |
| `telegram-client.ts` | Already reads env vars — works once you set them |
| `webhooks/x.ts` | HMAC CRC verification + DM event parsing |
| `webhooks/telegram.ts` | Match chatId to leads in your DB |
| `webhooks/discord.ts` | Slash command handlers (your team's custom commands) |
| `cron/scan.ts` | Already wired — optionally persist leads to Airtable |

---

## Step 7: Deploy

```bash
# Build & verify
npm run build

# Deploy to Vercel
vercel --prod

# Set all env vars in Vercel dashboard
vercel env add CRON_SECRET
vercel env add X_BEARER_TOKEN
# ... etc.

# Enable cron jobs
vercel cron
```

---

## Autonomy Architecture

```
                         ┌──────────────────────┐
                         │   Vercel Cron (1h)   │
                         │   /api/cron/scan     │
                         └──────────┬───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  /api/scout         │
                          │  GeckoTerminal scan │
                          │  + social links     │
                          └─────────┬───────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Orchestrator      │
                          │  handleEvent()     │
                          └──┬──────┬──────┬───┘
                             │      │      │
              ┌──────────────┘      │      └──────────────┐
              ▼                     ▼                     ▼
     ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐
     │ Dispatch DM    │   │ Premium Alert    │   │ Manual         │
     │ X or Telegram  │   │ Telegram team    │   │ Intervention   │
     │ via social link│   │ chat             │   │ Telegram alert │
     └───────┬────────┘   └──────────────────┘   └────────────────┘
             │
     ┌───────▼────────┐   ┌──────────────────┐
     │ X Webhook      │   │ Telegram         │
     │ /api/webhooks/x│   │ Webhook          │
     │ RECEIVE replies│   │ RECEIVE replies  │
     └────────────────┘   └──────────────────┘
```
