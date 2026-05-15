// =============================================================================
// Q&A HANDLER — Handle HITL questions during enrichment workflow
// =============================================================================
// Provides quick answers to common HITL questions like:
// - "Why is this person in the target audience?"
// - "What makes this lead a good fit?"
// - "Can you explain the scoring?"
// - etc.

import { callAgent } from '../groq-client'
import { Message } from '../types'
import { AnalyzedProfile } from '../profile-filter'

export interface QAContext {
  leadId: string
  projectName: string
  painPoint: string
  targetAudiences?: AnalyzedProfile[]
  scores?: Record<string, number>
}

/**
 * System prompt for Q&A agent
 */
const QA_SYSTEM_PROMPT = `You are a helpful assistant providing context and answers about lead qualification and outreach.
Your role is to help the HITL (human-in-the-loop) operator understand:
- Why a lead is a good fit
- Why specific people are identified as target audience
- How scoring works
- General outreach strategy questions

Be concise, clear, and use simple language. Avoid jargon.
Reference specific data when available.`

/**
 * Answer HITL questions about the lead
 */
export async function answerLeadQuestion(
  context: QAContext,
  question: string
): Promise<string> {
  console.log(`[QA] Answering: ${question.slice(0, 80)}...`)

  const contextStr = formatContextForQA(context)

  const prompt = `
Context about the lead:
${contextStr}

HITL Question:
"${question}"

Provide a clear, concise answer.
`.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const answer = await callAgent('qa', messages, QA_SYSTEM_PROMPT)
    console.log(`[QA] Answer: ${answer.slice(0, 100)}...`)
    return answer
  } catch (error: any) {
    console.error(`[QA] Question answering failed:`, error.message)
    return `Sorry, I couldn't answer that question. Error: ${error.message}`
  }
}

/**
 * Explain why a specific profile was selected as target audience
 */
export async function explainProfileSelection(
  context: QAContext,
  profile: AnalyzedProfile
): Promise<string> {
  const prompt = `
Lead: ${context.projectName}
Pain Point: ${context.painPoint}

Target Profile:
- Username: @${profile.username}
- Score: ${profile.score}/100
- Role: ${profile.role} [${profile.priority}]
- Signals: ${profile.signals.join(', ')}
- Bio: ${profile.bio}

Why is this person a good target for outreach to ${context.projectName}?
Explain briefly in 2-3 sentences.
`.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    return callAgent('qa', messages, QA_SYSTEM_PROMPT)
  } catch (error: any) {
    console.error(`[QA] Profile explanation failed:`, error.message)
    return `Unable to explain profile selection. Error: ${error.message}`
  }
}

/**
 * Answer common questions with pre-built responses
 */
export async function answerCommonQuestion(
  context: QAContext,
  questionType: 'why_scoring' | 'why_these_people' | 'next_steps' | 'what_is_target' | 'custom',
  customQuestion?: string
): Promise<string> {
  const commonAnswers: Record<string, string> = {
    why_scoring: `
The scoring system (0-100) evaluates:
- **Admin/Moderator status** (40pts): They have influence in the community
- **X/Twitter verification** (25pts): Authenticated account, likely established
- **Keyword signals** (varies): Mentions of alpha, KOL, founder, community lead, etc.
- **Combined signals**: Multiple tags increase score exponentially

This helps us prioritize HIGH-VALUE contacts who can amplify ${context.projectName}.
    `,

    why_these_people: `
We scanned ${context.projectName}'s Telegram community and identified members with:
- Active community roles (admins, moderators)
- Established X/Twitter presence
- Keyword indicators of influence or technical expertise
- Engagement patterns showing leadership

These people are likely to be interested AND able to help amplify the project.
    `,

    next_steps: `
Next steps after you approve:
1. Our system sends the personalized outreach message
2. We monitor for replies to gauge interest
3. If interested, we provide onboarding resources
4. If no response, we follow up after 48 hours

Your job: Review the draft and approve if it looks good!
    `,

    what_is_target: `
**Target audience** = High-value community members most likely to:
- Share the project with their network
- Provide feedback or collaboration opportunities
- Become long-term community leaders
- Help with strategic partnerships

We identify them by analyzing real Telegram group members' profiles and activity.
    `,
  }

  if (questionType === 'custom' && customQuestion) {
    return answerLeadQuestion(context, customQuestion)
  }

  return commonAnswers[questionType] || 'Question type not recognized.'
}

/**
 * Format enrichment context for Q&A
 */
function formatContextForQA(context: QAContext): string {
  const lines: string[] = [
    `*Lead:* ${context.projectName}`,
    `*Pain Point:* ${context.painPoint}`,
  ]

  if (context.scores) {
    lines.push(`*Scores:*`, JSON.stringify(context.scores, null, 2))
  }

  if (context.targetAudiences && context.targetAudiences.length > 0) {
    lines.push(`*Top Target Profiles:*`)
    for (const profile of context.targetAudiences.slice(0, 3)) {
      lines.push(
        `  - @${profile.username}: ${profile.role} [${profile.priority}] (${profile.score}pts)`
      )
    }
  }

  return lines.join('\n')
}

/**
 * Suggest follow-up questions HITL might ask
 */
export async function suggestFollowUpQuestions(
  context: QAContext,
  draftMessage: string
): Promise<string[]> {
  const prompt = `
Lead: ${context.projectName}
Pain Point: ${context.painPoint}
Outreach Draft: "${draftMessage}"

What are 3 common questions a human reviewer might ask about this outreach?
List them as a JSON array of strings.
Example: ["Why is this person a good fit?", "How many people will we contact?", ...]
    `.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const response = await callAgent('qa', messages, QA_SYSTEM_PROMPT)

    // Try to parse as JSON
    try {
      const questions = JSON.parse(response)
      if (Array.isArray(questions)) {
        return questions.filter((q) => typeof q === 'string').slice(0, 3)
      }
    } catch {
      // Fallback: return default questions
    }

    return [
      'Why is this person a good target?',
      'How many people will we contact?',
      'What if they reply negatively?',
    ]
  } catch (error: any) {
    console.error(`[QA] Suggestion failed:`, error.message)
    return []
  }
}
