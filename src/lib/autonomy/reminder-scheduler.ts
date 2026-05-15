// =============================================================================
// REMINDER SCHEDULER — Follow-up reminders for incomplete enrichment steps
// =============================================================================
// Sends periodic reminders to HITL if they haven't completed an enrichment step
// Configuration:
// - First reminder: 1 hour
// - Second reminder: 2 hours
// - Max reminders: 3 before auto-skipping

import { getCachedContext, incrementReminders, updateEnrichmentStep } from './lead-enrichment-handler'
import { sendEnrichmentReminder } from './telegram-client'
import { airtableClient } from '../airtable-client'

export interface ReminderConfig {
  maxReminders: number
  reminderIntervals: number[] // in milliseconds
  autoSkipAfterMax: boolean
}

const DEFAULT_CONFIG: ReminderConfig = {
  maxReminders: 3,
  reminderIntervals: [
    3600 * 1000,      // 1 hour
    7200 * 1000,      // 2 hours
    14400 * 1000,     // 4 hours
  ],
  autoSkipAfterMax: true,
}

// In-memory tracker of reminders already sent
// In production, use persistent storage (Redis, Airtable, etc)
const reminderTracker = new Map<string, {
  lastReminderTime: number
  reminderCount: number
  step: string
}>()

/**
 * Check if an enrichment context needs a reminder
 */
export function shouldSendReminder(
  leadId: string,
  config: ReminderConfig = DEFAULT_CONFIG
): boolean {
  const context = getCachedContext(leadId)
  if (!context) return false

  // Don't remind if already completed or skipped
  if (context.currentStep === 'completed' || context.currentStep === 'skipped') {
    return false
  }

  const tracker = reminderTracker.get(leadId)
  if (!tracker) {
    // First time checking this lead
    return true
  }

  if (tracker.reminderCount >= config.maxReminders) {
    return false // Max reminders reached
  }

  // Check if enough time has passed since last reminder
  const nextReminderTime = config.reminderIntervals[tracker.reminderCount]
  const timeSinceLastReminder = Date.now() - tracker.lastReminderTime

  return timeSinceLastReminder >= nextReminderTime
}

/**
 * Send a reminder to HITL and update tracker
 */
export async function sendReminder(
  leadId: string,
  config: ReminderConfig = DEFAULT_CONFIG
): Promise<{ ok: boolean; error?: string }> {
  const context = getCachedContext(leadId)
  if (!context) {
    return { ok: false, error: 'Lead not found' }
  }

  const tracker = reminderTracker.get(leadId) || {
    lastReminderTime: context.startedAt,
    reminderCount: 0,
    step: context.currentStep,
  }

  try {
    // Send reminder message
    await sendEnrichmentReminder(
      leadId,
      context.projectName,
      context.currentStep,
      tracker.reminderCount + 1
    )

    // Update tracker
    tracker.lastReminderTime = Date.now()
    tracker.reminderCount += 1
    tracker.step = context.currentStep
    reminderTracker.set(leadId, tracker)

    // Update enrichment context with reminder count
    await incrementReminders(leadId)

    console.log(`[Reminder] Sent reminder #${tracker.reminderCount} for ${leadId} (step: ${context.currentStep})`)

    // Check if we should auto-skip
    if (tracker.reminderCount >= config.maxReminders && config.autoSkipAfterMax) {
      console.log(`[Reminder] Auto-skipping ${leadId} after max reminders`)
      try {
        await updateEnrichmentStep(leadId, 'skipped')
        await airtableClient.updateLead(leadId, {
          status: 'skipped',
          notes: 'Auto-skipped after max reminders'
        })
      } catch (err) {
        console.warn(`[Reminder] Failed to auto-skip:`, err)
      }
    }

    return { ok: true }
  } catch (error: any) {
    console.error(`[Reminder] Failed to send reminder:`, error.message)
    return { ok: false, error: error.message }
  }
}

/**
 * Process all pending leads and send reminders as needed
 * Typically called by a cron job
 */
export async function processReminderQueue(
  config: ReminderConfig = DEFAULT_CONFIG
): Promise<{
  processed: number
  sent: number
  errors: number
}> {
  console.log(`[ReminderScheduler] Processing reminder queue`)

  let processed = 0
  let sent = 0
  let errors = 0

  try {
    // Get all leads from Airtable
    const leads = await airtableClient.getLeads()

    for (const record of leads) {
      processed++
      const leadId = record.id

      // Check if enrichment is in progress
      const enrichmentStep = record.fields.enrichment_step
      if (!enrichmentStep || enrichmentStep === 'completed' || enrichmentStep === 'skipped') {
        continue
      }

      // Check if reminder needed
      if (shouldSendReminder(leadId, config)) {
        const result = await sendReminder(leadId, config)
        if (result.ok) {
          sent++
        } else {
          errors++
        }
      }
    }
  } catch (err: any) {
    console.error(`[ReminderScheduler] Queue processing failed:`, err.message)
    errors++
  }

  console.log(`[ReminderScheduler] Processed: ${processed}, Sent: ${sent}, Errors: ${errors}`)
  return { processed, sent, errors }
}

/**
 * Clear a lead's reminder tracking (for testing or manual reset)
 */
export function clearReminderTracking(leadId: string): void {
  reminderTracker.delete(leadId)
}

/**
 * Get reminder tracker stats
 */
export function getReminderStats(): {
  total: number
  byStep: Record<string, number>
  averageReminders: number
} {
  const byStep: Record<string, number> = {}
  let totalReminders = 0

  for (const tracker of reminderTracker.values()) {
    byStep[tracker.step] = (byStep[tracker.step] || 0) + 1
    totalReminders += tracker.reminderCount
  }

  return {
    total: reminderTracker.size,
    byStep,
    averageReminders: reminderTracker.size > 0 ? totalReminders / reminderTracker.size : 0,
  }
}

/**
 * Export tracker for testing/debugging
 */
export function getTrackerData(): Map<string, any> {
  return new Map(reminderTracker)
}
