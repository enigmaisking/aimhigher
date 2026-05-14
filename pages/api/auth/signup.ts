import { NextApiRequest, NextApiResponse } from 'next'
import { airtableClient } from '../../../src/lib/airtable-client'
import { hashPassword, createToken, setSessionCookie } from '../../../src/lib/auth'
import { ApiResponse } from '../../../src/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { email, password, name } = req.body

  if (!email || !password || !name) {
    return res.status(400).json({ ok: false, error: 'Email, name, and password required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })
  }

  if (!email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Enter a valid email address' })
  }

  try {
    const existing = await airtableClient.getUserByEmail(email)
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' })
    }

    const passwordHash = await hashPassword(password)
    const user = await airtableClient.createUser(email, name, passwordHash)

    const token = createToken(user)
    setSessionCookie(res, token)

    return res.status(201).json({
      ok: true,
      data: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error: any) {
    console.error('[Signup Error]', error)
    return res.status(500).json({ ok: false, error: error.message || 'Signup failed' })
  }
}
