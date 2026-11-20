import { timingSafeEqual } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
const eq = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && timingSafeEqual(A, B) }
export function requireBearer(req: NextApiRequest, res: NextApiResponse, env: 'CRON_SECRET' | 'INTERNAL_API_KEY'): boolean {
  const secret = process.env[env]
  const got = (req.headers.authorization || '').replace(/^Bearer /, '')
  if (!secret || !got || !eq(got, secret)) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return false }
  return true
}
