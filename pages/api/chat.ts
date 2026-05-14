// pages/api/chat.ts
// Groq LLM proxy for all agents (Scout, Rex, Aria, Sage)
// API key never reaches the browser

import { NextApiRequest, NextApiResponse } from 'next'
import { callAgent } from '../../src/lib/groq-client'
import { AGENT_PROMPTS } from '../../src/lib/agents'
import { withAuth } from '../../src/lib/auth'
import { Message, ApiResponse } from '../../src/lib/types'

type AgentType = 'scout' | 'outreach' | 'onboard' | 'qa'

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { agent, messages, systemOverride } = req.body as {
    agent: AgentType
    messages: Message[]
    systemOverride?: string
  }

  // Validate input
  if (!agent || !messages || !Array.isArray(messages)) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: agent, messages',
    })
  }

  if (!['scout', 'outreach', 'onboard', 'qa'].includes(agent)) {
    return res.status(400).json({ ok: false, error: `Unknown agent: ${agent}` })
  }

  if (!messages.every(m => m.role && m.content)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid message format',
    })
  }

  try {
    const systemPrompt = systemOverride || AGENT_PROMPTS[agent]
    if (!systemPrompt) {
      return res.status(400).json({
        ok: false,
        error: `No system prompt configured for agent: ${agent}`,
      })
    }

    const text = await callAgent(agent, messages, systemPrompt)

    return res.status(200).json({
      ok: true,
      text,
    })
  } catch (error: any) {
    console.error('[Chat API Error]', error)

    const message = error?.message || 'Unknown error'
    const statusCode = message.includes('rate limit') ? 429 : 500

    return res.status(statusCode).json({
      ok: false,
      error: message,
    })
  }
}

export default withAuth(handler)
