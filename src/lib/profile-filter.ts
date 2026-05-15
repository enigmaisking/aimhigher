import { Lead } from './types'

export interface TelegramProfile {
  userId: number
  username: string | null
  firstName: string
  lastName?: string
  bio: string
  isAdmin: boolean
  isBot: boolean
  isPremium?: boolean
  groupId: number
  groupTitle: string
  photoUrl?: string
  messageFrequency?: number
  hasLinkedX?: boolean
  isVerified?: boolean
}

export interface AnalyzedProfile extends TelegramProfile {
  score: number
  priority: 'high' | 'medium' | 'low'
  role: ProfileRole
  signals: string[]
  outreachDraft?: string
  projectName?: string
}

export type ProfileRole =
  | 'founder'
  | 'growth_lead'
  | 'community_manager'
  | 'partnerships'
  | 'kol_manager'
  | 'strategic_member'
  | 'member'

type ProfileTag =
  | 'FOUNDER'
  | 'ADMIN'
  | 'GROWTH'
  | 'MARKETING'
  | 'COMMUNITY_MANAGER'
  | 'PARTNERSHIPS'
  | 'KOL_MANAGER'
  | 'STRATEGIC'
  | 'INFLUENCER'
  | 'DEV'

export interface ScanRequest {
  projectName: string
  chain: string
  groupId: number
  groupTitle: string
  profiles: TelegramProfile[]
}

export interface HITLAction {
  action: 'approve' | 'skip' | 'send' | 'discard'
  profileId: number
  groupId: number
  projectName: string
}

export const SCORE_THRESHOLDS = {
  HIGH_VALUE: 70,
  MEDIUM_VALUE: 45,
}

const PRIORITY_ORDER: ProfileRole[] = [
  'founder',
  'growth_lead',
  'partnerships',
  'community_manager',
  'kol_manager',
  'strategic_member',
  'member',
]

const EXCLUDE_KEYWORDS = [
  'support bot', 'airdrop', 'claim', 'whitelist', 'spam',
  'price bot', 'chart bot', 'moderator bot', 'announcement bot',
  'inactive', 'unverified',
]

const SIGNAL_KEYWORDS: Record<string, { weight: number; keywords: string[]; signal: string }> = {
  FOUNDER:          { weight: 60, keywords: ['founder', 'co-founder', 'ceo', 'core contributor', 'builder', 'team lead', 'building', 'created'], signal: 'founder keywords' },
  GROWTH:           { weight: 55, keywords: ['head of growth', 'growth lead', 'growth', 'marketing lead', 'marketing', 'user acquisition', 'campaigns', 'community growth'], signal: 'growth-related keywords' },
  COMMUNITY_MANAGER: { weight: 40, keywords: ['community manager', 'cm', 'moderator', 'ambassador lead', 'ambassador', 'mod', 'community lead', 'welcomes', 'coordinates'], signal: 'community management' },
  PARTNERSHIPS:     { weight: 45, keywords: ['partnerships', 'ecosystem', 'business development', 'bizdev', 'collabs', 'integration', 'partnership'], signal: 'partnership-related activity' },
  KOL_MANAGER:      { weight: 35, keywords: ['kol', 'influencer', 'creator', 'promotion', 'coordinator', 'collab manager'], signal: 'KOL campaign management' },
  STRATEGIC:        { weight: 30, keywords: ['advisor', 'strategic', 'ecosystem lead', 'community development', 'growth advisor'], signal: 'strategic contributor' },
  INFLUENCER:       { weight: 25, keywords: ['influencer', 'content creator', 'youtube', 'tiktok', 'follower'], signal: 'influencer' },
  DEV:              { weight: 20, keywords: ['developer', 'engineer', 'solidity', 'smart contract', 'rust', 'audit', 'protocol'], signal: 'developer' },
}

export function analyzeProfile(profile: TelegramProfile): AnalyzedProfile {
  let score = 0
  const signals: string[] = []
  const tags: ProfileTag[] = []

  const combinedText = `${profile.firstName} ${profile.lastName || ''} ${profile.bio}`.toLowerCase()
  const username = (profile.username || '').toLowerCase()

  if (EXCLUDE_KEYWORDS.some(k => combinedText.includes(k) || username.includes(k))) {
    return {
      ...profile,
      score: 0,
      priority: 'low',
      role: 'member',
      signals: ['excluded'],
    }
  }

  const isAdmin = profile.isAdmin
  const hasLinkedX = profile.hasLinkedX || /twitter\.com|x\.com/i.test(profile.bio)
  const hasHighActivity = (profile.messageFrequency || 0) > 50
  const hasMediumActivity = (profile.messageFrequency || 0) > 20
  const isVerified = profile.isVerified || profile.isPremium || false

  if (isAdmin) {
    score += 40
    signals.push('admin badge')
    tags.push('ADMIN')
  }

  if (hasLinkedX) {
    score += 20
    signals.push('linked socials')
  }

  if (hasHighActivity) {
    score += 20
    signals.push('high message frequency')
  } else if (hasMediumActivity) {
    score += 10
    signals.push('active contributor')
  }

  if (isVerified) {
    score += 10
    signals.push('verified account')
  }

  for (const [tag, data] of Object.entries(SIGNAL_KEYWORDS)) {
    if (data.keywords.some(k => combinedText.includes(k) || username.includes(k))) {
      score += data.weight
      if (!signals.includes(data.signal)) signals.push(data.signal)
      if (!tags.includes(tag as ProfileTag)) tags.push(tag as ProfileTag)
    }
  }

  const role = classifyProfileByTags(tags, isAdmin, hasLinkedX)
  const priority = roleToPriority(role)

  if (priority === 'low') {
    score = Math.min(score, 30)
    signals.push('minimal interaction')
  }

  if (!isAdmin && !hasLinkedX && !hasHighActivity && score < 20) {
    signals.push('low activity')
    signals.push('no socials')
  }

  return {
    ...profile,
    score: Math.min(score, 100),
    priority,
    role,
    signals: [...new Set(signals)],
  }
}

function classifyProfileByTags(tags: ProfileTag[], isAdmin: boolean, hasLinkedX: boolean): ProfileRole {
  if (tags.includes('FOUNDER')) return 'founder'
  if (tags.includes('GROWTH')) return 'growth_lead'
  if (tags.includes('PARTNERSHIPS')) return 'partnerships'
  if (tags.includes('COMMUNITY_MANAGER')) return 'community_manager'
  if (tags.includes('KOL_MANAGER')) return 'kol_manager'
  if (tags.includes('STRATEGIC') || tags.includes('INFLUENCER')) return 'strategic_member'
  if (isAdmin && hasLinkedX) return 'founder'
  if (isAdmin) return 'community_manager'
  if (tags.includes('DEV')) return 'strategic_member'
  return 'member'
}

function roleToPriority(role: ProfileRole): 'high' | 'medium' | 'low' {
  switch (role) {
    case 'founder':
    case 'growth_lead':
    case 'community_manager':
      return 'high'
    case 'partnerships':
    case 'kol_manager':
      return 'medium'
    case 'strategic_member':
      return 'medium'
    default:
      return 'low'
  }
}

export function getPriorityOrder(tier: 'high' | 'medium' | 'low'): ProfileRole[] {
  if (tier === 'high') return ['founder', 'growth_lead', 'community_manager']
  if (tier === 'medium') return ['partnerships', 'kol_manager', 'strategic_member']
  return ['member']
}

export function filterHighValueProfiles(
  profiles: AnalyzedProfile[],
  minScore: number = SCORE_THRESHOLDS.HIGH_VALUE
): AnalyzedProfile[] {
  return profiles
    .filter(p => p.score >= minScore && !p.signals.includes('excluded') && p.role !== 'member')
    .sort((a, b) => {
      const aOrder = PRIORITY_ORDER.indexOf(a.role)
      const bOrder = PRIORITY_ORDER.indexOf(b.role)
      if (aOrder !== bOrder) return aOrder - bOrder
      return b.score - a.score
    })
}

export function classifyProfile(profile: AnalyzedProfile): string {
  return profile.role
}

export function generateOutreachDraft(
  profile: AnalyzedProfile,
  projectName: string
): string {
  const handle = profile.username || `user ${profile.userId}`

  const templates: Record<string, string> = {
    founder: `Hey @${handle}, saw you're leading ${projectName}. We help protocols scale growth by rewarding contributors for driving real on-chain capital — not vanity metrics. Open to a quick chat about growth systems?`,

    growth_lead: `Hey @${handle}, noticed your role in ${projectName}. AimHigher helps growth teams turn community engagement into real user acquisition and on-chain capital. Worth exploring?`,

    community_manager: `Hey @${handle}, you clearly drive the ${projectName} community. AimHigher helps reward active members for contributing real value. Would love your take on it.`,

    partnerships: `Hey @${handle}, saw you're handling partnerships for ${projectName}. AimHigher creates collaboration opportunities through on-chain incentive pools that reward capital, not impressions. Worth a conversation?`,

    kol_manager: `Hey @${handle}, noticed you manage KOL campaigns for ${projectName}. AimHigher complements influencer work by tying rewards to actual on-chain capital referred. Could be a powerful addition.`,

    strategic_member: `Hey @${handle}, you're active in ${projectName} and clearly understand the space. We help projects convert community energy into real TVL growth. Interested to hear your thoughts.`,
  }

  const draft = templates[profile.role]
  if (draft) return draft

  return `Hey @${handle}, noticed you in the ${projectName} community. We help projects reward real on-chain contributions. Would love to connect.`
}

export function buildDashboardCard(
  profile: AnalyzedProfile,
  projectName: string,
  queuePosition: number,
  queueTotal: number
): DashboardCard {
  const handle = profile.username ? `@${profile.username}` : `id:${profile.userId}`
  const roleLabel = profile.role.toUpperCase()
  const priorityLabel = profile.priority.toUpperCase()
  const signalLine = profile.signals.map(s => `• ${s}`).join('\n')

  const text = [
    `🎯 *Profile Scan — ${projectName}*`,
    `Queue: ${queuePosition}/${queueTotal}`,
    ``,
    `*${handle}*  \`${roleLabel}\`  [${priorityLabel}]`,
    `Score: ${profile.score}/100`,
    ``,
    `*Signals:*`,
    signalLine,
    ``,
    profile.bio ? `*Bio:* ${profile.bio.slice(0, 200)}` : '',
    ``,
    profile.outreachDraft ? `*Draft:*\n${profile.outreachDraft}` : '',
  ].filter(Boolean).join('\n')

  const buttons: InlineButton[][] = [
    [
      { text: '✅ Approve & Queue', callbackData: `profile_approve_${profile.userId}_${profile.groupId}_${encodeURIComponent(projectName)}` },
      { text: '⏭️ Skip', callbackData: `profile_skip_${profile.userId}_${profile.groupId}` },
    ],
    [
      { text: '📝 Edit Draft', callbackData: `profile_edit_${profile.userId}_${profile.groupId}` },
      { text: '🗑️ Discard', callbackData: `profile_discard_${profile.userId}_${profile.groupId}` },
    ],
  ]

  return { text, buttons }
}

export function buildSummaryCard(
  projectName: string,
  totalScanned: number,
  highValue: number,
  approved: number
): DashboardCard {
  const text = [
    `📊 *Scan Complete — ${projectName}*`,
    ``,
    `Total members scanned: ${totalScanned}`,
    `High-value profiles: ${highValue}`,
    `Approved for outreach: ${approved}`,
    ``,
    approved > 0
      ? `Use the queue to review each profile.`
      : `No high-value profiles found. Try adjusting the threshold or scanning other groups.`,
  ].join('\n')

  return { text, buttons: [] }
}

export function buildApprovedConfirmationCard(
  profile: AnalyzedProfile,
  projectName: string
): DashboardCard {
  const handle = profile.username ? `@${profile.username}` : `id:${profile.userId}`
  const text = [
    `✅ *Approved — ${handle}*`,
    `Project: ${projectName}`,
    `Score: ${profile.score}/100`,
    `Role: ${profile.role.toUpperCase()}`,
    `Priority: ${profile.priority.toUpperCase()}`,
    ``,
    `*Draft ready:*`,
    profile.outreachDraft || '',
  ].join('\n')

  const buttons: InlineButton[][] = [
    [
      { text: '📤 Send Now', callbackData: `profile_send_${profile.userId}_${profile.groupId}_${encodeURIComponent(projectName)}` },
      { text: '📋 Save to Queue', callbackData: `profile_save_${profile.userId}_${profile.groupId}_${encodeURIComponent(projectName)}` },
    ],
  ]

  return { text, buttons }
}

export function profileToLead(
  profile: AnalyzedProfile,
  projectName: string,
  chain: string
): Omit<Lead, 'id' | 'created_at' | 'updated_at'> {
  const score = Math.round((profile.score / 100) * 10)
  const verdict = score >= 8 ? 'PREMIUM' : 'LEAD'
  const handle = profile.username ? `@${profile.username}` : `tg:${profile.userId}`

  return {
    project_name: projectName,
    token_ticker: '',
    chain,
    contract_address: '',
    estimated_mcap: '',
    why_good_fit: `Role: ${profile.role}, Priority: ${profile.priority}, Signals: ${profile.signals.join(', ')}`,
    pain_point: profile.bio.slice(0, 300) || `Potential ${profile.role} in ${projectName}`,
    estimated_treasury_size: '',
    contact_handle: handle,
    source_signal: `telegram_scan:${profile.groupTitle}`,
    snapshot_vote: null,
    fit_score: score,
    score_breakdown: {
      sector_alpha: 0,
      sentiment_pain: 0,
      engagement_gap: 0,
      chain_momentum: 0,
    },
    verdict,
    hook: profile.outreachDraft || '',
    status: 'new',
    notes: JSON.stringify({
      role: profile.role,
      priority: profile.priority,
      signals: profile.signals,
      rawScore: profile.score,
      groupId: profile.groupId,
      userId: profile.userId,
    }),
    created_by: 'profile-filter',
  }
}

export function processScanResults(scan: ScanRequest): {
  analyzed: AnalyzedProfile[]
  highValue: AnalyzedProfile[]
} {
  const analyzed = scan.profiles.map(analyzeProfile)
  const highValue = filterHighValueProfiles(analyzed)

  for (const profile of highValue) {
    profile.projectName = scan.projectName
    profile.outreachDraft = generateOutreachDraft(profile, scan.projectName)
  }

  return { analyzed, highValue }
}

export interface ProfileQueue {
  projectName: string
  profiles: AnalyzedProfile[]
  currentIndex: number
  approved: AnalyzedProfile[]
  skipped: number[]
}

export interface DashboardCard {
  text: string
  buttons: InlineButton[][]
}

export interface InlineButton {
  text: string
  callbackData: string
}

export function createQueue(projectName: string, profiles: AnalyzedProfile[]): ProfileQueue {
  return {
    projectName,
    profiles: profiles.sort((a, b) => {
      const aOrder = PRIORITY_ORDER.indexOf(a.role)
      const bOrder = PRIORITY_ORDER.indexOf(b.role)
      if (aOrder !== bOrder) return aOrder - bOrder
      return b.score - a.score
    }),
    currentIndex: 0,
    approved: [],
    skipped: [],
  }
}

export function getCurrentProfile(queue: ProfileQueue): AnalyzedProfile | null {
  return queue.profiles[queue.currentIndex] ?? null
}

export function approveCurrent(queue: ProfileQueue): ProfileQueue {
  const profile = queue.profiles[queue.currentIndex]
  if (!profile) return queue
  return {
    ...queue,
    approved: [...queue.approved, profile],
    currentIndex: queue.currentIndex + 1,
  }
}

export function skipCurrent(queue: ProfileQueue): ProfileQueue {
  const profile = queue.profiles[queue.currentIndex]
  if (!profile) return queue
  return {
    ...queue,
    skipped: [...queue.skipped, profile.userId],
    currentIndex: queue.currentIndex + 1,
  }
}

export function isScanComplete(queue: ProfileQueue): boolean {
  return queue.currentIndex >= queue.profiles.length
}

export function parseCallbackData(raw: string): HITLAction | null {
  const parts = raw.split('_')
  if (parts.length < 4) return null

  const actionMap: Record<string, HITLAction['action']> = {
    profile_approve: 'approve',
    profile_skip: 'skip',
    profile_send: 'send',
    profile_discard: 'discard',
  }

  const prefix = `${parts[0]}_${parts[1]}`
  const action = actionMap[prefix]
  if (!action) return null

  const profileId = Number(parts[2])
  const groupId = Number(parts[3])

  if (action === 'skip' || action === 'discard') {
    return { action, profileId, groupId, projectName: '' }
  }

  const projectName = decodeURIComponent(parts.slice(4).join('_'))
  return { action, profileId, groupId, projectName }
}
