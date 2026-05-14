// =============================================================================
// AUTONOMY LAYER — Lead State Machine
// =============================================================================
// Drives leads through Scout → Outreach → Onboard → Live autonomously.
// Each transition fires events that the orchestrator picks up.

import { LeadStage, AgentId } from './types'

interface Transition {
  from: LeadStage[]
  to: LeadStage
  agent: AgentId
  condition: (lead: Record<string, unknown>) => boolean
  onTransition?: (leadId: string) => Promise<void>
}

const TRANSITIONS: Transition[] = [
  {
    from: ['Scouted'],
    to: 'In conversation',
    agent: 'outreach',
    condition: (lead) => Number(lead.score) >= 7,
    onTransition: undefined, // TODO: implement notification
  },
  {
    from: ['In conversation'],
    to: 'Qualified',
    agent: 'outreach',
    condition: (lead) => lead.qualified === true,
  },
  {
    from: ['Qualified'],
    to: 'Onboarding',
    agent: 'onboard',
    condition: (lead) => lead.readyForOnboarding === true,
  },
  {
    from: ['Onboarding'],
    to: 'Live',
    agent: 'onboard',
    condition: (lead) => lead.poolDeployed === true,
  },
]

export function getNextTransition(
  lead: Record<string, unknown>
): Transition | null {
  const currentStage = (lead.stage || 'Scouted') as LeadStage
  return TRANSITIONS.find(
    (t) => t.from.includes(currentStage) && t.condition(lead)
  ) || null
}

export function canAutoHandoff(score: number, threshold: number): boolean {
  return score >= threshold
}

export function isEligibleForOutreach(lead: {
  stage: LeadStage
  score: number
  lastContacted?: number | null
  cooldownHours: number
}): boolean {
  if (lead.stage !== 'Scouted') return false
  if (lead.score < 7) return false
  if (lead.lastContacted) {
    const hoursSince = (Date.now() - lead.lastContacted) / 1000 / 3600
    if (hoursSince < lead.cooldownHours) return false
  }
  return true
}
