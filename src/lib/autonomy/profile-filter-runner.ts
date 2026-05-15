// =============================================================================
// PROFILE FILTER RUNNER — Wrapper for running profile analysis
// =============================================================================
// Runs the profile-filter.ts logic against a Telegram group after HITL confirms
// they've joined. Uses existing profile-filter.ts to identify target audience.

import { analyzeProfile, AnalyzedProfile, SCORE_THRESHOLDS } from '../profile-filter'
import { TelegramProfile } from '../profile-filter'
import { updateEnrichmentStep } from './lead-enrichment-handler'

export interface FilterRunResult {
  success: boolean
  totalProfiles: number
  highValueProfiles: AnalyzedProfile[]
  mediumValueProfiles: AnalyzedProfile[]
  topTags: string[]
  error?: string
}

/**
 * Run profile filter on a Telegram group to identify target audience
 * Typically called after HITL confirms they've joined the group
 */
export async function runProfileFilter(
  leadId: string,
  _groupId: number,
  groupTitle: string,
  profiles: TelegramProfile[]
): Promise<FilterRunResult> {
  console.log(
    `[ProfileFilter] Running filter for ${profiles.length} profiles in ${groupTitle}`
  )

  try {
    // Analyze each profile
    const analyzed: AnalyzedProfile[] = profiles.map((p) => analyzeProfile(p))

    // Separate by score
    const highValue = analyzed.filter((p) => p.score >= SCORE_THRESHOLDS.HIGH_VALUE)
    const mediumValue = analyzed.filter(
      (p) => p.score >= SCORE_THRESHOLDS.MEDIUM_VALUE && p.score < SCORE_THRESHOLDS.HIGH_VALUE
    )

    // Aggregate tags from high-value profiles
    const tagCounts: Record<string, number> = {}
    for (const profile of highValue) {
      for (const tag of profile.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    // Sort tags by frequency
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag)

    const result: FilterRunResult = {
      success: true,
      totalProfiles: profiles.length,
      highValueProfiles: highValue,
      mediumValueProfiles: mediumValue,
      topTags,
    }

    // Update enrichment context
    try {
      await updateEnrichmentStep(leadId, 'generating_draft', {
        targetAudience: highValue.map((p) => ({
          userId: p.userId,
          username: p.username,
          score: p.score,
          tags: p.tags,
        })),
      })
    } catch (err) {
      console.warn(`[ProfileFilter] Failed to update enrichment:`, err)
    }

    console.log(
      `[ProfileFilter] Identified: ${highValue.length} high-value, ${mediumValue.length} medium-value profiles`
    )
    console.log(`[ProfileFilter] Top tags: ${topTags.join(', ')}`)

    return result
  } catch (error: any) {
    console.error(`[ProfileFilter] Filter execution failed:`, error.message)
    return {
      success: false,
      totalProfiles: profiles.length,
      highValueProfiles: [],
      mediumValueProfiles: [],
      topTags: [],
      error: error.message,
    }
  }
}

/**
 * Format filter results for human review
 */
export function formatFilterResults(result: FilterRunResult, groupTitle: string): string {
  if (!result.success) {
    return `❌ *Filter Error for ${groupTitle}*\n${result.error}`
  }

  const lines = [
    `📊 *Group Analysis: ${groupTitle}*`,
    ``,
    `Total members scanned: ${result.totalProfiles}`,
    `🥇 High-value targets: ${result.highValueProfiles.length}`,
    `🥈 Medium-value: ${result.mediumValueProfiles.length}`,
    ``,
    `🏷️ *Top target profiles:* ${result.topTags.join(', ')}`,
    ``,
  ]

  if (result.highValueProfiles.length > 0) {
    lines.push(`*Top 5 High-Value Members:*`)
    for (const profile of result.highValueProfiles.slice(0, 5)) {
      const tagStr = profile.tags.slice(0, 2).join(', ')
      lines.push(
        `  • @${profile.username || `user_${profile.userId}`} (${profile.score}pts) - ${tagStr}`
      )
    }
  }

  return lines.join('\n')
}

/**
 * Export cache keys for monitoring
 */
export const FILTER_CACHE_PREFIX = 'filter_result_'

export function getCacheKey(leadId: string): string {
  return `${FILTER_CACHE_PREFIX}${leadId}`
}
