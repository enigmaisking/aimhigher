import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearer } from '../../../src/guards'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireBearer(req, res, 'CRON_SECRET')) return

  try {
    const { processReminderQueue } = await import('../../../src/lib/autonomy/reminder-scheduler')
    const result = await processReminderQueue()

    return res.status(200).json({ ok: true, data: result })
  } catch (error: any) {
    console.error('[Reminder Cron] Error:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
