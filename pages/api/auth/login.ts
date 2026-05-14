// pages/api/auth/login.ts
// User login endpoint

import { NextApiRequest, NextApiResponse } from 'next'
import { airtableClient } from '../../../src/lib/airtable-client'
import { verifyPassword, createToken, setSessionCookie } from '../../../src/lib/auth'
import { ApiResponse } from '../../../src/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { email, password } = req.body

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required' })
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Invalid input format' })
  }

  try {
    // Find user by email
    const user = await airtableClient.getUserByEmail(email)
    if (!user) {
      // Generic error message (don't reveal if email exists)
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    // Create JWT and set cookie
    const token = createToken(user)
    setSessionCookie(res, token)

    return res.status(200).json({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: any) {
    console.error('[Login Error]', error)

    // Check if it's an Airtable configuration error
    if (error.message?.includes('AIRTABLE')) {
      return res.status(500).json({
        ok: false,
        error: 'Authentication service error: Check Airtable configuration',
      })
    }

    return res.status(500).json({
      ok: false,
      error: error.message || 'Login failed',
    })
  }
}
