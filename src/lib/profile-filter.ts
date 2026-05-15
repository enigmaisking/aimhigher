import { Lead } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
}

export interface AnalyzedProfile extends TelegramProfile {
  score: number
  tags: ProfileTag[]
  outreachDraft?: string
  projectName?: string
}

export type ProfileTag =
  | 'FOUNDER'
  | 'ADMIN'
  | 'KOL'
  | 'INFLUENCER'
  | 'ALPHA'
  | 'VERIFIED_X'
  | 'COMMUNITY_LEAD'
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

// ─────────────────────────────────────────────────────────────────────────────
// SCORING MATRIX
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_KEYWORDS: Record<ProfileTag, { weight: number; keywords: string[] }> = {
  FOUNDER:       { weight: 50, keywords: ['our project', 'launching', 'mainnet', 'tokenomics', 'roadmap', 'founder', 'co-founder', 'built'] },
  ADMIN:         { weight: 40, keywords: ['admin', 'moderator', 'management', 'team lead'] },
  KOL:           { weight: 40, keywords: ['ama', 'collab', 'partnered', 'marketing', 'promotion', 'shill', 'kol'] },
  INFLUENCER:    { weight: 35, keywords: ['influencer', 'content creator', 'youtube', 'tiktok', 'follower'] },
  ALPHA:         { weight: 45, keywords: ['entry', 'target', '100x', 'moonshot', 'alpha', 'loading', 'call', 'signal'] },
  VERIFIED_X:    { weight: 25, keywords: [] },
  COMMUNITY_LEAD:{ weight: 30, keywords: ['community lead', 'community manager', 'ambassador', 'mod'] },
  DEV:           { weight: 20, keywords: ['developer', 'engineer', 'solidity', 'smart contract', 'rust', 'audit'] },
}

export const SCORE_THRESHOLDS = {
  HIGH_VALUE: 60,
  MEDIUM_VALUE: 40,
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeProfile(profile: TelegramProfile): AnalyzedProfile {
  let score = 0
  const tags: ProfileTag[] = []

  if (profile.isAdmin) {
    score += 40
    tags.push('ADMIN')
  }

  const hasXLink = /twitter\.com|x\.com/i.test(profile.bio)
  if (hasXLink) {
    score += 25
    tags.push('VERIFIED_X')
  }

  const combinedText = `${profile.firstName} ${profile.lastName || ''} ${profile.bio}`.toLowerCase()

  for (const [tag, data] of Object.entries(SIGNAL_KEYWORDS) as [ProfileTag, typeof SIGNAL_KEYWORDS[ProfileTag]][]) {
    if (tag === 'VERIFIED_X') continue
    if (data.keywords.some((k) => combinedText.includes(k))) {
      score += data.weight
      if (!tags.includes(tag)) tags.push(tag)
    }
  }

  return {
    ...profile,
    score: Math.min(score, 100),
    tags,
  }
}

export function filterHighValueProfiles(
  profiles: AnalyzedProfile[],
  minScore: number = SCORE_THRESHOLDS.HIGH_VALUE
): AnalyzedProfile[] {
  return profiles
    .filter((p) => p.score >= minScore && !p.isBot)
    .sort((a, b) => b.score - a.score)
}

export function classifyProfile(profile: AnalyzedProfile): string {
  if (profile.tags.includes('FOUNDER')) return 'founder'
  if (profile.tags.includes('KOL') || profile.tags.includes('INFLUENCER')) return 'kol'
  if (profile.tags.includes('ADMIN')) return 'admin'
  if (profile.tags.includes('COMMUNITY_LEAD')) return 'community_lead'
  if (profile.tags.includes('DEV')) return 'dev'
  if (profile.tags.includes('ALPHA')) return 'alpha'
  return 'member'
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTREACH DRAFT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export function generateOutreachDraft(
  profile: AnalyzedProfile,
  projectName: string
): string {
  const handle = profile.username || `user ${profile.userId}`
  const role = classifyProfile(profile)

  const templates: Record<string, string> = {
    founder: `Hey @${handle}, saw you're building in the ${projectName} community. We help protocols reward contributors for driving real on-chain capital — not vanity metrics. Open to a quick chat?`,
    kol: `Hey @${handle}, noticed your presence in ${projectName}. We're looking for KOLs who can drive real wallet activity, not just impressions. Want to hear more?`,
    admin: `Hey @${handle}, you seem key to the ${projectName} community. AimHigher helps turn engaged members into capital-driving contributors. Worth a conversation?`,
    community_lead: `Hey @${handle}, you clearly understand the ${projectName} community. We help projects reward real on-chain contributions. Would love your take.`,
    dev: `Hey @${handle}, noticed you in the ${projectName} dev community. If you're working on growth experiments, AimHigher ties rewards to on-chain capital, not vanity. Thoughts?`,
    alpha: `Hey @${handle}, saw your signals in ${projectName}. We help projects convert community energy into real TVL growth. Interested?`,
  }

  return templates[role] || templates.member
}

// ─────────────────────────────────────────────────────────────────────────────
// HITL DASHBOARD (Telegram Admin)
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardCard {
  text: string
  buttons: InlineButton[][]
}

export interface InlineButton {
  text: string
  callbackData: string
}

export function buildDashboardCard(
  profile: AnalyzedProfile,
  projectName: string,
  queuePosition: number,
  queueTotal: number
): DashboardCard {
  const handle = profile.username ? `@${profile.username}` : `id:${profile.userId}`
  const roleLabel = classifyProfile(profile).toUpperCase()
  const tagLine = profile.tags.map((t) => `#${t}`).join(' ')

  const text = [
    `🚀 *Profile Scan — ${projectName}*`,
    `Queue: ${queuePosition}/${queueTotal}`,
    ``,
    `*${handle}*  \`${roleLabel}\``,
    `Score: ${profile.score}/100  |  ${tagLine}`,
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
    `Role: ${classifyProfile(profile).toUpperCase()}`,
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

// ─────────────────────────────────────────────────────────────────────────────
// LEAD CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

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
    why_good_fit: `Profile scan: ${profile.tags.join(', ')} in ${profile.groupTitle}`,
    pain_point: profile.bio.slice(0, 300) || 'No bio available',
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
      tags: profile.tags,
      rawScore: profile.score,
      groupId: profile.groupId,
      userId: profile.userId,
    }),
    created_by: 'profile-filter',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileQueue {
  projectName: string
  profiles: AnalyzedProfile[]
  currentIndex: number
  approved: AnalyzedProfile[]
  skipped: number[]
}

export function createQueue(projectName: string, profiles: AnalyzedProfile[]): ProfileQueue {
  return {
    projectName,
    profiles,
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

// ─────────────────────────────────────────────────────────────────────────────
// TELEGRAM CALLBACK PARSER (for webhook handler)
// ─────────────────────────────────────────────────────────────────────────────

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
