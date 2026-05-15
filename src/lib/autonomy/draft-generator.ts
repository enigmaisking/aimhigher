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
const OUTREACH_SYSTEM_PROMPT = `You are an expert Web3 growth strategist crafting outreach to project founders.
Your task: generate a short DM from AimHigher (aimhigher.gg) to a project founder.

ABOUT AIMHIGHER:
AimHigher is a performance-based marketing platform for Web3 projects.
Projects launch on-chain incentive pools that reward contributors for driving
REAL invested capital — not vanity metrics like likes, impressions, or follows.
Setup takes under 10 minutes. Minimum pool: $2,500 equivalent in any token.
Scoring favors referred capital (2x) and invested capital (1x) — bots and
fake traffic score zero. Supported chains: ETH, SOL, BNB, Base, ARB, OP,
Polygon, AVAX, FTM.

Guidelines:
1. Keep it SHORT (2-3 sentences max)
2. Lead with their SPECIFIC pain point — show you understand their growth struggle
3. Then connect it to what AimHigher offers (performance-based, on-chain, real capital)
4. Address founders/team only — not KOLs or community members
5. Include a clear call-to-action (quick chat, see a demo)
6. Be genuine and peer-to-peer — no spam, no hype
7. End with: "Would you be open to a quick chat?" or similar CTA
8. NEVER mention KOLs, influencers, or community members as targets

Example structure:
"Hey, saw [project] has [specific pain point]. AimHigher helps projects turn
marketing spend into real on-chain TVL — not just impressions. Worth a
10-min chat to see if it's a fit?"

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
Generate a personalized outreach message from AimHigher to a project founder:

Project: ${input.projectName} (${input.tokenTicker || 'N/A'})
Chain: ${input.chain}
Mcap: ${input.estimatedMcap || 'N/A'}

Their Pain Point (lead with this):
${input.painPoint}

Positioning Hook:
${input.hook}

Target: Founder/team of ${input.projectName} only.

Generate a SHORT, compelling DM that:
1. Opens with their specific pain point
2. Connects it to AimHigher's performance-based, on-chain model
3. Offers a quick chat to explore if it's a fit

Target audience is the PROJECT TEAM (founders) — NOT KOLs or community members.
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
