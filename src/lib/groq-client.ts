// lib/groq-client.ts
// Groq API wrapper for LLM calls

import Groq from 'groq-sdk'
import { Message } from './types'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export const GROQ_MODELS = {
  scout: 'llama-3.3-70b-versatile', // Much faster for JSON scoring
  outreach: 'llama-3.3-70b-versatile', // Great for conversation
  onboard: 'llama-3.1-8b-instant', // Fast, low-latency for guidance
  qa: 'llama-3.1-8b-instant', // Very fast for simple questions
}
export async function createChatCompletion(
  model: string,
  messages: Message[],
  system: string,
  maxTokens: number = 1000
): Promise<string> {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured')
    }

    const response = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    })

    const text = response.choices[0]?.message?.content || ''
    return text.trim()
  } catch (error: any) {
    console.error('[Groq Error]', error)
    const message = error?.message || 'Unknown Groq API error'

    // Rate limit detection
    if (error?.status === 429) {
      throw new Error('Groq rate limit exceeded. Try again in 60 seconds.')
    }

    // Auth error detection
    if (error?.status === 401 || message.includes('invalid api key')) {
      throw new Error('Groq API key invalid or expired')
    }

    // Generic error
    throw new Error(`Groq API error: ${message}`)
  }
}

export function parseJSON(text: string, retries = 2): any {
  try {
    // First attempt: clean markdown fences if present
    let cleaned = text.trim()
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }
    cleaned = cleaned.trim()

    return JSON.parse(cleaned)
  } catch (error) {
    if (retries > 0) {
      // Fallback: try to extract JSON object from text
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        return parseJSON(match[0], retries - 1)
      }
    }
    console.error('[JSON Parse Error]', error, 'Text:', text.slice(0, 100))
    throw new Error('Failed to parse response as JSON')
  }
}

export async function callAgent(
  agentType: 'scout' | 'outreach' | 'onboard' | 'qa',
  messages: Message[],
  system: string
): Promise<string> {
  const model = GROQ_MODELS[agentType]
  const maxTokens = agentType === 'scout' ? 3000 : 500

  return createChatCompletion(model, messages, system, maxTokens)
}
