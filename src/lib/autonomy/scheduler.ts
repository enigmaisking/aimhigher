// =============================================================================
// AUTONOMY LAYER — Scheduled Scan Manager
// =============================================================================
// Manages autonomous scan cycles. The /api/cron/scan endpoint calls this.
// For Vercel: use Vercel Cron Jobs (vercel.json).
// For self-hosted: use system cron or node-cron.

import { AutonomyConfig } from './types'

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  scanIntervalMinutes: 60,        // Scan every hour by default
  maxLeadsPerScan: 20,            // Cap at 20 leads per cycle
  autoHandoffThreshold: 8.5,      // Auto-handoff PREMIUM leads to Outreach
  notifyOnPremium: true,           // Send Slack/Discord alerts
  outreachCooldownHours: 48,       // Don't re-contact within 48h
}

let currentConfig: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG }

export function getConfig(): AutonomyConfig {
  return { ...currentConfig }
}

export function updateConfig(partial: Partial<AutonomyConfig>): AutonomyConfig {
  currentConfig = { ...currentConfig, ...partial }
  console.log('[Autonomy] Config updated:', JSON.stringify(currentConfig))
  return getConfig()
}

// ─── CRON JOB SUPPORT ────────────────────────────────────────────────────────
// For Vercel: add to vercel.json:
// {
//   "crons": [
//     { "path": "/api/cron/scan", "schedule": "0 * * * *" }
//   ]
// }
// For self-hosted (node-cron):
// import cron from 'node-cron'
// cron.schedule('0 * * * *', () => fetch('http://localhost:3000/api/cron/scan'))
// ─────────────────────────────────────────────────────────────────────────────

export function cronSchedule(minutes: number): string {
  if (minutes < 60) return `*/${minutes} * * * *`
  const hours = Math.floor(minutes / 60)
  return `0 */${hours} * * *`
}
