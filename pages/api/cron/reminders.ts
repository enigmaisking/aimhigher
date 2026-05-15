import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  try {
    const { processReminderQueue } = await import('../../../src/lib/autonomy/reminder-scheduler')
    const result = await processReminderQueue()

    return res.status(200).json({ ok: true, data: result })
  } catch (error: any) {
    console.error('[Reminder Cron] Error:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
