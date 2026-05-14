// pages/api/auth/me.ts
// Get current authenticated user

import { NextApiRequest, NextApiResponse } from 'next'
import { getSessionFromCookie } from '../../../src/lib/auth'
import { ApiResponse } from '../../../src/lib/types'

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const session = getSessionFromCookie(req)

    if (!session) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' })
    }

    return res.status(200).json({
      ok: true,
      data: {
        userId: session.userId,
        email: session.email,
        name: session.name,
      },
    })
  } catch (error: any) {
    console.error('[Me Error]', error)
    return res.status(500).json({
      ok: false,
      error: 'Failed to get current user',
    })
  }
}

export default handler
