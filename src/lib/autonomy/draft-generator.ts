// =============================================================================
// DRAFT GENERATOR — LLM-powered outreach message generation
// =============================================================================
// Uses Groq LLM to generate personalized outreach messages based on:
// 1. Project pain points and value proposition
// 2. Target audience profile (identified via profile-filter.ts)
// 3. Project social links and community context

import { callAgent } from '../groq-client'
import { Message } from '../types'
import { updateEnrichmentStep } from './lead-enrichment-handler'

export interface DraftGeneratorInput {
  projectName: string
  chain: string
  painPoint: string
  hook: string
  verdict: string
  targetAudienceTags: string[]
  targetAudienceCount: number
  tokenTicker?: string
  estimatedMcap?: string
}

export interface GeneratedDraft {
  outreach: string
  onboarding: string
  suggestions?: string[]
}

/**
 * System prompt for outreach draft generation
 */
const OUTREACH_SYSTEM_PROMPT = `You are an expert Web3 community manager and growth strategist.
Your task is to generate personalized outreach messages for DeFi/blockchain projects.

Guidelines:
1. Keep outreach SHORT and punchy (2-3 sentences max)
2. Lead with VALUE to the target audience
3. Address their specific role/tag (e.g., if KOL: mention influence, if Dev: mention technical integration)
4. Include a clear call-to-action
5. Be genuine - no spam or BS
6. Reference the project's pain point to show understanding
7. End with a link or contact method

Output ONLY the message text, no explanations.`

/**
 * System prompt for onboarding guidance
 */
const ONBOARDING_SYSTEM_PROMPT = `You are a Web3 product expert helping users understand new projects.
Generate a brief, beginner-friendly onboarding guide for someone interested in a DeFi/blockchain project.

Guidelines:
1. Assume the person is interested but new to this specific project
2. Explain the value proposition in simple terms
3. Include 3-5 key benefits for their specific role/segment
4. Add ONE concrete next step they should take
5. Keep it friendly and encouraging, not technical jargon

Output ONLY the onboarding message, no explanations.`

/**
 * Generate outreach message using LLM
 */
export async function generateOutreachDraft(input: DraftGeneratorInput): Promise<string> {
  console.log(`[DraftGenerator] Generating outreach for ${input.projectName}`)

  const targetInfo = input.targetAudienceTags
    .slice(0, 3)
    .map((tag) => {
      const descriptions: Record<string, string> = {
        FOUNDER: 'founders and project leads',
        ADMIN: 'admins and community managers',
        KOL: 'key opinion leaders and influencers',
        INFLUENCER: 'content creators',
        ALPHA: 'alpha/signal callers',
        VERIFIED_X: 'X/Twitter verified accounts',
        COMMUNITY_LEAD: 'community organizers',
        DEV: 'developers and technical builders',
      }
      return descriptions[tag] || tag.toLowerCase()
    })
    .join(', ')

  const prompt = `
Generate a personalized outreach message for:

Project: ${input.projectName} (${input.tokenTicker || 'N/A'})
Chain: ${input.chain}
Mcap: ${input.estimatedMcap || 'N/A'}

Value Proposition:
${input.painPoint}

Positioning Hook:
${input.hook}

Target Audience: ${input.targetAudienceCount} high-value members
Roles: ${targetInfo}

Generate a SHORT, compelling DM that would resonate with this audience.
Make them want to learn more or take action immediately.
`.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const draft = await callAgent('outreach', messages, OUTREACH_SYSTEM_PROMPT)
    console.log(`[DraftGenerator] Outreach generated: ${draft.slice(0, 100)}...`)
    return draft
  } catch (error: any) {
    console.error(`[DraftGenerator] Outreach generation failed:`, error.message)
    throw error
  }
}

/**
 * Generate onboarding message using LLM
 */
export async function generateOnboardingDraft(input: DraftGeneratorInput): Promise<string> {
  console.log(`[DraftGenerator] Generating onboarding for ${input.projectName}`)

  const targetInfo = input.targetAudienceTags
    .slice(0, 2)
    .map((tag) => {
      const descriptions: Record<string, string> = {
        FOUNDER: 'as a project founder',
        ADMIN: 'as a community manager',
        KOL: 'as an influencer',
        INFLUENCER: 'as a content creator',
        ALPHA: 'as an alpha caller',
        VERIFIED_X: 'as a verified account holder',
        COMMUNITY_LEAD: 'as a community leader',
        DEV: 'as a developer',
      }
      return descriptions[tag] || tag.toLowerCase()
    })
    .join(' and ')

  const prompt = `
Create an onboarding message for someone joining ${input.projectName}:

Project: ${input.projectName} (${input.tokenTicker || 'N/A'})
Chain: ${input.chain}

Overview:
${input.painPoint}

They are interested ${targetInfo}.

Make them feel welcomed and give them 3 concrete first steps to get started.
`.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const draft = await callAgent('onboard', messages, ONBOARDING_SYSTEM_PROMPT)
    console.log(`[DraftGenerator] Onboarding generated: ${draft.slice(0, 100)}...`)
    return draft
  } catch (error: any) {
    console.error(`[DraftGenerator] Onboarding generation failed:`, error.message)
    throw error
  }
}

/**
 * Generate both outreach and onboarding drafts
 */
export async function generateFullDraft(
  leadId: string,
  input: DraftGeneratorInput
): Promise<GeneratedDraft> {
  console.log(`[DraftGenerator] Generating full draft for ${input.projectName}`)

  try {
    const [outreach, onboarding] = await Promise.all([
      generateOutreachDraft(input),
      generateOnboardingDraft(input),
    ])

    const draft: GeneratedDraft = {
      outreach,
      onboarding,
      suggestions: [
        `Message is personalized for ${input.targetAudienceCount} high-value community members`,
        `Positions ${input.projectName} around their pain point: "${input.painPoint.slice(0, 50)}..."`,
        `Mentions key audience segments: ${input.targetAudienceTags.slice(0, 2).join(', ')}`,
      ],
    }

    // Update enrichment status
    try {
      await updateEnrichmentStep(leadId, 'awaiting_approval', {
        outreachDraft: outreach,
        onboardingDraft: onboarding,
      })
    } catch (err) {
      console.warn(`[DraftGenerator] Failed to update enrichment:`, err)
    }

    return draft
  } catch (error: any) {
    console.error(`[DraftGenerator] Full draft generation failed:`, error.message)
    throw error
  }
}

/**
 * Generate suggestions for improving a draft (for HITL feedback loop)
 */
export async function getSuggestionsForDraft(
  originalMessage: string,
  feedback: string
): Promise<string> {
  const prompt = `
Original message:
"${originalMessage}"

User feedback:
"${feedback}"

Based on their feedback, provide 2-3 specific suggestions for improving the message.
Keep suggestions actionable and brief.
`.trim()

  try {
    const messages: Message[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    return callAgent('qa', messages, 'You are a helpful assistant providing feedback on outreach messages.')
  } catch (error: any) {
    console.error(`[DraftGenerator] Suggestions generation failed:`, error.message)
    throw error
  }
}
