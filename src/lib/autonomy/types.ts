// =============================================================================
// AUTONOMY LAYER — Types
// =============================================================================
// Full autonomy event types, agent states, and action schemas.
// Fill in custom event handlers below.

export type LeadStage = 'Scouted' | 'In conversation' | 'Qualified' | 'Onboarding' | 'Live' | 'Disqualified'

export type AgentId = 'scout' | 'outreach' | 'onboard' | 'qa'

export type PlatformType = 'x' | 'telegram' | 'reddit' | 'discord' | 'email'

export interface AutonomyConfig {
  scanIntervalMinutes: number    // How often Scout runs automatically
  maxLeadsPerScan: number        // Cap leads per cycle
  autoHandoffThreshold: number   // Score threshold for auto-handoff to Outreach
  notifyOnPremium: boolean       // Send Slack/Discord alert on PREMIUM leads
  outreachCooldownHours: number  // Don't message same lead twice within window
  // TODO: Fill in your API keys in .env.local (see AUTONOMY_SETUP.md)
}

export interface AutonomyEvent {
  type: 'SCAN_COMPLETE' | 'LEAD_FOUND' | 'LEAD_PROMOTED' | 'OUTREACH_SENT' | 'REPLY_RECEIVED' | 'ONBOARDING_STARTED' | 'CAMPAIGN_LIVE'
  leadId?: string
  agentId?: AgentId
  timestamp: number
  payload?: Record<string, unknown>
}

export interface AgentState {
  currentAgent: AgentId
  leadId: string | null
  step: number
  history: AutonomyEvent[]
  startedAt: number
}

export interface MessagePayload {
  platform: PlatformType
  recipientId: string
  recipientName: string
  text: string
  leadName: string
}
