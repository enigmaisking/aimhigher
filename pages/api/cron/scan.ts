// =============================================================================
// AUTONOMY LAYER — Scheduled Scan Cron Endpoint
// =============================================================================
// Called by Vercel Cron Jobs or system cron every N minutes.
// Triggers a full Scout scan, persists leads to Airtable, and fires
// SCAN_COMPLETE event into the orchestrator (which sends HITL cards).
//
// Setup:
//   A. Vercel Cron — add to vercel.json:
//      { "crons": [{ "path": "/api/cron/scan", "schedule": "0 * * * *" }] }
//   B. Self-hosted — add to crontab:
//      curl -X POST https://your-site.com/api/cron/scan
//

import type { NextApiRequest, NextApiResponse } from 'next'
import { airtableClient } from '../../../src/lib/airtable-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── Auth guard (prevents unauthorized triggers) ──────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  try {
    // Step 1: Run the Scout scan (reuse existing logic)
    const chains = (process.env.SCOUT_CHAINS || 'eth,solana,bsc,base,avax,arbitrum,optimism,polygon-pos,fantom')
      .split(',')
      .map(c => c.trim())

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const scoutResponse = await fetch(`${appUrl}/api/scout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chains,
        minimumScore: 8.5,
        pageSize: 20,
        manualSignals: [],
      }),
    })

    if (!scoutResponse.ok) {
      throw new Error(`Scout API returned ${scoutResponse.status}`)
    }

    const { data } = await scoutResponse.json()
    const leads = data?.leads || []

    console.log(`[Cron] Scan complete: ${leads.length} leads found across ${chains.length} chains`)

    // Step 2: Persist each lead to Airtable
    let savedCount = 0
    const savedLeads: any[] = []

    for (const lead of leads) {
      try {
        const airtableRecord = await airtableClient.createLead({
          project_name: lead.name || lead.project_name,
          token_ticker: (lead.ticker || lead.token_ticker || '').replace('$', ''),
          chain: lead.chain,
          contract_address: lead.tokenAddress || lead.contract_address || '',
          estimated_mcap: lead.mcap || lead.estimated_mcap || '',
          why_good_fit: lead.why_good_fit || '',
          pain_point: lead.painPoint || lead.pain_point || '',
          estimated_treasury_size: lead.treasury || lead.estimated_treasury_size || '',
          contact_handle: lead.twitterHandle || lead.contact_handle || '',
          source_signal: lead.source_signal || lead.poolSource || 'cron-scan',
          snapshot_vote: lead.snapshot_vote || null,
          fit_score: lead.score ?? lead.fit_score ?? 0,
          score_breakdown_json: JSON.stringify(lead.scoreBreakdown || lead.score_breakdown || {}),
          verdict: lead.verdict || 'LEAD',
          hook: lead.hook || '',
          status: 'new',
          created_by: 'cron-scan',
          notes: lead.notes || lead.nextAction || '',
        })

        const savedLead = {
          id: airtableRecord?.id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          project_name: lead.name || lead.project_name,
          token_ticker: (lead.ticker || lead.token_ticker || '').replace('$', ''),
          chain: lead.chain,
          contract_address: lead.tokenAddress || lead.contract_address || '',
          estimated_mcap: lead.mcap || lead.estimated_mcap || '',
          why_good_fit: lead.why_good_fit || '',
          pain_point: lead.painPoint || lead.pain_point || '',
          estimated_treasury_size: lead.treasury || lead.estimated_treasury_size || '',
          contact_handle: lead.twitterHandle || lead.contact_handle || '',
          source_signal: lead.source_signal || lead.poolSource || 'cron-scan',
          snapshot_vote: lead.snapshot_vote || null,
          fit_score: lead.score ?? lead.fit_score ?? 0,
          score_breakdown: lead.scoreBreakdown || lead.score_breakdown || {},
          verdict: lead.verdict || 'LEAD',
          hook: lead.hook || '',
          status: 'new',
        }

        savedLeads.push(savedLead)
        savedCount++
      } catch (err) {
        const name = lead.name || lead.project_name || 'unknown'
        console.warn(`[Cron] Failed to save lead "${name}" to Airtable:`, err)
      }
    }

    // Step 3: Fire events into the orchestrator with cached leads
    const { handleEvent, cacheLead } = await import('../../../src/lib/autonomy/orchestrator')

    // Cache all saved leads so the orchestrator has them
    for (const lead of savedLeads) {
      cacheLead({
        ...lead,
        score: lead.fit_score,
        name: lead.project_name,
        ticker: lead.token_ticker,
        mcap: lead.estimated_mcap,
        painPoint: lead.pain_point,
        twitterHandle: lead.contact_handle?.replace('@', '') || null,
        telegramHandle: null,
        tokenAddress: lead.contract_address || null,
        stage: undefined,
        qualified: undefined,
        readyForOnboarding: undefined,
        poolDeployed: undefined,
        lastContacted: null,
      })
    }

    await handleEvent({
      type: 'SCAN_COMPLETE',
      timestamp: Date.now(),
      payload: {
        count: savedLeads.length,
        chainCount: chains.length,
        leads: savedLeads,
      },
    })

    return res.status(200).json({
      ok: true,
      data: {
        leadsFound: leads.length,
        savedToAirtable: savedCount,
        scannedChains: chains.length,
      },
    })
  } catch (error: any) {
    console.error('[Cron] Scan failed:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
