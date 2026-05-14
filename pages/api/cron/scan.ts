// =============================================================================
// AUTONOMY LAYER — Scheduled Scan Cron Endpoint
// =============================================================================
// Called by Vercel Cron Jobs or system cron every N minutes.
// Triggers a full Scout scan and fires SCAN_COMPLETE event.
//
// TODO (choose one):
//   A. Vercel Cron — add to vercel.json:
//      { "crons": [{ "path": "/api/cron/scan", "schedule": "0 * * * *" }] }
//   B. Self-hosted — add to crontab:
//      curl -X POST https://your-site.com/api/cron/scan
//      (protect with CRON_SECRET in .env.local)

import type { NextApiRequest, NextApiResponse } from 'next'

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

    const scoutResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chains,
        sourceTypes: ['onchain'],
        minimumScore: 7,
        pageSize: 20,
        manualSignals: [],
      }),
    })

    if (!scoutResponse.ok) {
      throw new Error(`Scout API returned ${scoutResponse.status}`)
    }

    const { data } = await scoutResponse.json()
    const leads = data?.leads || []

    console.log(`[Cron] Scan complete: ${leads.length} leads found`)

    // Step 2: Fire events into the orchestrator
    const { handleEvent } = await import('../../../src/lib/autonomy/orchestrator')

    await handleEvent({
      type: 'SCAN_COMPLETE',
      timestamp: Date.now(),
      payload: { count: leads.length },
    })

    for (const lead of leads) {
      await handleEvent({
        type: 'LEAD_FOUND',
        leadId: lead.id,
        timestamp: Date.now(),
        payload: lead,
      })

      if (lead.score >= 8.5) {
        await handleEvent({
          type: 'LEAD_PROMOTED',
          leadId: lead.id,
          timestamp: Date.now(),
          payload: { newStage: 'In conversation', agent: 'outreach' },
        })
      }

      // TODO: Save leads to persistent store
      // await airtableClient.createLead(leadToAirtableRecord(lead))
    }

    return res.status(200).json({
      ok: true,
      data: { leadsFound: leads.length, scannedChains: chains.length },
    })
  } catch (error: any) {
    console.error('[Cron] Scan failed:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
