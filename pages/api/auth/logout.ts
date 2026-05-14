// pages/api/auth/logout.ts
// User logout endpoint

import { NextApiRequest, NextApiResponse } from 'next'
import { clearSessionCookie } from '../../../src/lib/auth'
import { ApiResponse } from '../../../src/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // Clear session cookie
    clearSessionCookie(res)

    return res.status(200).json({
      ok: true,
      data: { message: 'Logged out successfully' },
    })
  } catch (error: any) {
    console.error('[Logout Error]', error)
    return res.status(500).json({
      ok: false,
      error: 'Logout failed',
    })
  }
}
