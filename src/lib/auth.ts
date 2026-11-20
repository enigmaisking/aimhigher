// lib/auth.ts
// JWT and password helpers for authentication

import jwt from 'jsonwebtoken'
import bcryptjs from 'bcryptjs'
import { NextApiRequest, NextApiResponse } from 'next'
import { Session, User } from './types'
import { parse } from 'cookie'

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET missing or too short')
  return secret
})()
const JWT_EXPIRY = '7d'

// ─────────────────────────────────────────────
// PASSWORD HELPERS
// ─────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10)
  return bcryptjs.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash)
}

// ─────────────────────────────────────────────
// JWT HELPERS
// ─────────────────────────────────────────────

export function createToken(user: User): string {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyToken(token: string): Session | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as Session
    return decoded
  } catch (error) {
    return null
  }
}

// ─────────────────────────────────────────────
// SESSION HELPERS
// ─────────────────────────────────────────────

export function getSessionFromCookie(req: NextApiRequest): Session | null {
  try {
    const cookies = parse(req.headers.cookie || '')
    const token = cookies.session
    if (!token) return null
    return verifyToken(token)
  } catch (error) {
    return null
  }
}

export function setSessionCookie(res: NextApiResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` // 7 days
  )
}

export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
}

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown

export function withAuth(handler: NextApiHandler): NextApiHandler {
  return (req: NextApiRequest, res: NextApiResponse) => {
    const session = getSessionFromCookie(req)
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' })
    }
    // Attach session to request for use in handler
    ;(req as any).session = session
    return handler(req, res)
  }
}
