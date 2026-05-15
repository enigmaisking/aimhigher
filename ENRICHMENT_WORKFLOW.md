# Enhanced Lead Enrichment Workflow Integration Guide

## Overview
This document describes the new multi-step HITL (Human-In-The-Loop) enrichment workflow that has been integrated into the XAim autonomy system. The workflow enhances lead quality before outreach by:

1. **Fetching social links** from GeckoTerminal
2. **Requesting HITL to join groups** and follow X accounts
3. **Running profile filtering** on Telegram groups to identify target audience
4. **Generating personalized drafts** using LLM (Groq)
5. **HITL approval** before sending outreach

---

## Workflow Sequence

```
Scout finds lead (fit_score ≥ 7)
    ↓
[HITL receives Telegram card]
    ↓
HITL clicks "Hand Off to Outreach"
    ↓
Step 1: FETCH SOCIAL LINKS [AUTOMATIC]
├─ Query GeckoTerminal API for project social links
├─ Extract Twitter, Telegram, Discord, Website, GitHub
└─ Save to enrichment context
    ↓
Step 2: REQUEST GROUP JOIN [HITL ACTION]
├─ Send Telegram message with:
│  ├─ Social links (clickable buttons)
│  ├─ Instructions to join group and follow X
│  └─ "Confirmed Joined" button
├─ HITL joins and clicks confirmation
└─ Update enrichment_step → "running_profile_filter"
    ↓
Step 3: FILTER PROFILES [AUTOMATIC]
├─ Fetch group members from Telegram (requires bot membership)
├─ Run profile-filter.ts analysis
├─ Identify high-value members:
│  ├─ Admins/Moderators
│  ├─ Verified X accounts
│  ├─ Keyword matches (founder, KOL, dev, etc)
│  └─ Score ≥ 60: HIGH_VALUE, ≥ 40: MEDIUM_VALUE
└─ Extract top tags (ADMIN, KOL, INFLUENCER, etc)
    ↓
Step 4: GENERATE DRAFTS [AUTOMATIC]
├─ LLM (Groq) generates:
│  ├─ Outreach message (personalized, 2-3 sentences)
│  └─ Onboarding guide (beginner-friendly)
├─ Context includes:
│  ├─ Project pain point
│  ├─ Target audience tags
│  ├─ Audience count
│  └─ Project value prop
└─ Save to enrichment context
    ↓
Step 5: HITL APPROVAL [HITL ACTION]
├─ Send draft for review with:
│  ├─ Outreach message preview
│  ├─ Onboarding message preview
│  └─ Action buttons: [Approve & Send] [Edit] [Skip]
├─ HITL reviews and clicks action
└─ Update enrichment_step → "completed" or "skipped"
    ↓
Step 6: SEND OUTREACH [AUTOMATIC]
├─ If approved:
│  ├─ Send DM via X or Telegram (preferred X first)
│  ├─ Update lead status → "contacted"
│  └─ Begin monitoring for replies
└─ If skipped:
   ├─ Mark lead as "skipped"
   └─ Move to next lead

```

---

## Files Created/Modified

### New Files

#### 1. `src/lib/autonomy/geckoterminal-enrich.ts`
**Purpose:** Fetch and extract social links from GeckoTerminal API

**Key Functions:**
- `fetchGeckoTerminalSocialLinks(contractAddress, chain)` - Main API caller
- `extractSocialLinks(attrs)` - Parse API response
- `formatSocialLinksForTelegram(links)` - Format for Telegram display
- `extractTelegramGroup(link)` - Parse Telegram link
- `extractTwitterHandle(link)` - Parse Twitter link

**Returns:** `SocialLinks` object with Twitter, Discord, Telegram, Website, GitHub

---

#### 2. `src/lib/autonomy/lead-enrichment-handler.ts`
**Purpose:** Manage multi-step enrichment workflow state

**Key Functions:**
- `enrichWithSocialLinks(leadId, projectName, contractAddress, chain)` - Step 1
- `formatGroupJoinRequest(context, telegramChatId)` - Format Step 2 message
- `updateEnrichmentStep(leadId, newStep, additionalData)` - State transitions
- `handleHITLGroupConfirmation(leadId, groupId)` - Process HITL confirmation
- `handleHITLDraftApproval(leadId, approved)` - Process draft approval
- `incrementReminders(leadId)` - Track reminder count

**State Machine:**
```
waiting_social_links
    ↓
awaiting_group_join → (HITL confirms) → running_profile_filter
    ↓
generating_draft → awaiting_approval
    ↓
completed (if approved) or skipped (if rejected)
```

---

#### 3. `src/lib/autonomy/profile-filter-runner.ts`
**Purpose:** Wrapper to run profile-filter.ts on Telegram group

**Key Functions:**
- `runProfileFilter(leadId, groupId, groupTitle, profiles)` - Main runner
- `formatFilterResults(result, groupTitle)` - Format for display

**Returns:** `FilterRunResult` with high/medium-value profiles and top tags

**Integration with profile-filter.ts:**
- Uses existing `analyzeProfile()` to score each member
- Filters by `SCORE_THRESHOLDS.HIGH_VALUE` (≥60)
- Extracts and aggregates tags from top profiles

---

#### 4. `src/lib/autonomy/draft-generator.ts`
**Purpose:** Generate personalized outreach and onboarding messages using LLM

**Key Functions:**
- `generateOutreachDraft(input)` - Create outreach message
- `generateOnboardingDraft(input)` - Create onboarding guide
- `generateFullDraft(leadId, input)` - Generate both
- `getSuggestionsForDraft(originalMessage, feedback)` - Iterative improvement

**LLM Models:**
- Outreach: `llama-3.3-70b-versatile` (for quality)
- Onboarding: `llama-3.1-8b-instant` (for speed)

---

#### 5. `src/lib/autonomy/qa-handler.ts`
**Purpose:** Answer HITL questions during enrichment review

**Key Functions:**
- `answerLeadQuestion(context, question)` - Generic Q&A
- `explainProfileSelection(context, profile)` - Why person was selected
- `answerCommonQuestion(context, questionType)` - Pre-built answers
- `suggestFollowUpQuestions(context, draft)` - Help HITL prepare

**Question Types:**
- `why_scoring` - Explain scoring algorithm
- `why_these_people` - Why specific profiles selected
- `next_steps` - What happens after approval
- `what_is_target` - Define target audience
- `custom` - Custom LLM Q&A

---

#### 6. `src/lib/autonomy/reminder-scheduler.ts`
**Purpose:** Send reminders if HITL doesn't complete a step

**Key Functions:**
- `shouldSendReminder(leadId, config)` - Check if reminder needed
- `sendReminder(leadId, config)` - Send and track reminder
- `processReminderQueue(config)` - Cron-friendly batch processor

**Configuration (in `ReminderConfig`):**
- `maxReminders`: 3 (default)
- `reminderIntervals`: [1hr, 2hrs, 4hrs]
- `autoSkipAfterMax`: true (auto-skip after max reminders)

---

### Modified Files

#### 1. `src/lib/autonomy/telegram-client.ts`
**Additions:**
- `sendMessageWithButtons(chatId, text, buttons)` - Generic button handler
- `sendTeamMessageWithButtons(text, buttons)` - Team chat version
- `sendGroupJoinRequest(leadId, projectName, message)` - Step 2 message
- `sendDraftForApproval(leadId, projectName, outreachDraft, onboardingDraft)` - Step 5 message
- `sendEnrichmentReminder(leadId, projectName, currentStep, reminderCount)` - Reminder message
- `sendEnrichmentComplete(projectName, targetAudienceCount, profileTags)` - Completion notification

---

#### 2. `src/lib/autonomy/orchestrator.ts`
**Additions to `handleHITLCallback()`:**
- New enrichment callback handlers:
  - `enrich_group_confirmed_*` - Process Step 2 confirmation
  - `enrich_draft_approve_*` - Process Step 5 approval
  - `enrich_skip_*` - Process skipping

**Note:** Original `approve`, `skip`, `discard` handlers remain unchanged for backward compatibility

---

## Integration Instructions

### 1. Environment Variables
Ensure these are configured in `.env.local`:
```bash
# Existing
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
GROQ_API_KEY=...
AIRTABLE_PAT=...
AIRTABLE_BASE_ID=...
AIRTABLE_LEADS_TABLE_ID=...

# New (optional, GeckoTerminal uses public API)
# GECKOTERMINAL_API_RATE_LIMIT=100  # requests per minute
```

### 2. Airtable Schema Updates
Add these fields to your Leads table:

| Field Name | Type | Notes |
|-----------|------|-------|
| `enrichment_step` | Single select | awaiting_group_join, running_profile_filter, generating_draft, awaiting_approval, completed, skipped |
| `social_links_json` | Long text | JSON string: {twitter, discord, telegram, website, github} |
| `target_audience_json` | Long text | JSON array of filtered profiles |
| `outreach_draft` | Long text | LLM-generated outreach message |
| `onboarding_draft` | Long text | LLM-generated onboarding guide |

### 3. Trigger the Enrichment Workflow
When HITL clicks "Hand Off to Outreach" on a lead:

```typescript
import { enrichWithSocialLinks } from '@/lib/autonomy/lead-enrichment-handler'
import { formatGroupJoinRequest, sendGroupJoinRequest } from '@/lib/autonomy/telegram-client'

// Step 1: Fetch social links (automatic)
const context = await enrichWithSocialLinks(
  leadId,
  projectName,
  contractAddress,
  chain
)

// Step 2: Request HITL to join group (automatic)
const message = await formatGroupJoinRequest(context, telegramChatId)
await sendGroupJoinRequest(leadId, projectName, message)
```

### 4. Add Reminders to Cron Jobs
In your `pages/api/cron/reminders.ts`:

```typescript
import { processReminderQueue } from '@/lib/autonomy/reminder-scheduler'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!validateVercelCron(req)) return res.status(401).json({ error: 'Unauthorized' })
  
  const result = await processReminderQueue()
  return res.status(200).json(result)
}
```

Set cron schedule in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 5. Webhook Callback Routing
The existing Telegram webhook (`pages/api/webhooks/telegram.ts`) automatically routes enrichment callbacks to `handleHITLCallback()`. No changes needed, but verify callback_data format:

**Format:** `enrich_{action}_{leadId}`

Examples:
- `enrich_group_confirmed_rec123xyz`
- `enrich_draft_approve_rec456abc`
- `enrich_skip_rec789def`

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENRICHMENT WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│   Lead from Scout        │
│   (fit_score ≥ 7)        │
└───────────┬──────────────┘
            │
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: FETCH SOCIAL LINKS [AUTOMATIC]                      │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ geckoterminal-enrich.ts                                 │ │
│ │  └─→ GeckoTerminal API                                  │ │
│ │      └─→ Extract: Twitter, Discord, Telegram, etc       │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │ enrichment_step = "awaiting_group_join"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: REQUEST GROUP JOIN [HITL ACTION]                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Telegram Message:                                       │ │
│ │  ├─ Social links (clickable)                            │ │
│ │  ├─ "✅ Confirmed Joined" button                         │ │
│ │  └─ "⏭️ Skip" button                                    │ │
│ │                                                         │ │
│ │ If no action → reminder-scheduler sends reminder:       │ │
│ │  ├─ After 1 hour (reminder #1)                          │ │
│ │  ├─ After 2 hours (reminder #2)                         │ │
│ │  ├─ After 4 hours (reminder #3)                         │ │
│ │  └─ Auto-skip if no response                            │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │ HITL clicks "Confirmed Joined"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ Webhook receives callback: enrich_group_confirmed_{leadId}   │
│  └─→ telegram.ts → orchestrator.handleHITLCallback()         │
└───────────┬──────────────────────────────────────────────────┘
            │ enrichment_step = "running_profile_filter"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: FILTER PROFILES [AUTOMATIC]                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ profile-filter-runner.ts                                │ │
│ │  └─→ profile-filter.ts (existing)                       │ │
│ │      ├─ Score each group member                         │ │
│ │      ├─ Extract tags (ADMIN, KOL, DEV, etc)             │ │
│ │      └─ Filter high-value (score ≥ 60)                  │ │
│ │                                                         │ │
│ │ Saves to enrichment context:                            │ │
│ │  ├─ targetAudience: [profiles]                          │ │
│ │  └─ topTags: ["ADMIN", "KOL", ...]                      │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │ enrichment_step = "generating_draft"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: GENERATE DRAFTS [AUTOMATIC]                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ draft-generator.ts + Groq LLM                           │ │
│ │  ├─ Outreach message:                                   │ │
│ │  │   └─ Personalized 2-3 sentence DM                    │ │
│ │  ├─ Onboarding guide:                                   │ │
│ │  │   └─ Beginner-friendly 3-5 steps                     │ │
│ │  └─ Context: pain point, audience, tags                 │ │
│ │                                                         │ │
│ │ Saves to enrichment context:                            │ │
│ │  ├─ outreachDraft: "Hey! I noticed..."                  │ │
│ │  └─ onboardingDraft: "Welcome! Here's..."               │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │ enrichment_step = "awaiting_approval"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: HITL APPROVAL [HITL ACTION]                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Telegram Message:                                       │ │
│ │  ├─ Preview outreach message                            │ │
│ │  ├─ Preview onboarding message                          │ │
│ │  ├─ "[✅ Approve & Send]" button                         │ │
│ │  ├─ "[✏️ Edit Draft]" button                             │ │
│ │  └─ "[⏭️ Skip Lead]" button                             │ │
│ │                                                         │ │
│ │ Q&A available:                                          │ │
│ │  └─→ qa-handler.ts                                      │ │
│ │      ├─ Why is this person a target?                    │ │
│ │      ├─ What makes this lead good?                      │ │
│ │      └─ How does scoring work?                          │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │ HITL clicks "Approve & Send"
            ↓
┌──────────────────────────────────────────────────────────────┐
│ STEP 6: SEND OUTREACH [AUTOMATIC]                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ notifications.ts → dispatchDM()                         │ │
│ │  ├─ Try X/Twitter first (project handle)                │ │
│ │  ├─ Fall back to Telegram if no X handle                │ │
│ │  └─ Send pre-approved message                           │ │
│ │                                                         │ │
│ │ Update Airtable:                                        │ │
│ │  ├─ status: "contacted"                                 │ │
│ │  ├─ notes: "Enriched outreach sent"                     │ │
│ │  └─ enrichment_step: "completed"                        │ │
│ └──────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────┘
            │
            ↓
┌──────────────────────────────────────────────────────────────┐
│ Monitor for replies → orchestrator.onReplyReceived()        │
│  └─→ Same intent parsing as before                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Verify GeckoTerminal API responds with social links
- [ ] Test Telegram bot sends group join request correctly
- [ ] Manually test button clicks (confirm, skip)
- [ ] Verify profile-filter identifies correct high-value members
- [ ] Test LLM draft generation (outreach + onboarding)
- [ ] Verify reminder scheduler sends follow-ups
- [ ] Test auto-skip after max reminders
- [ ] Verify Q&A handler answers questions correctly
- [ ] End-to-end: Scout → Hand off → Approve → DM sent
- [ ] Verify all enrichment context saved to Airtable

---

## Troubleshooting

### Social links not fetching
- Check GeckoTerminal API status
- Verify contract address format
- Check chain name mapping in `geckoterminal-enrich.ts`

### Telegram messages not sending
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Check bot has message permissions
- Review Telegram API error logs

### LLM drafts too long/short
- Adjust `maxTokens` in `groq-client.ts`
- Refine system prompts in `draft-generator.ts`
- Test with different Groq models

### Profile filter missing target audience
- Verify bot is member of Telegram group
- Check Telegram API returns group members
- Review scoring thresholds in `profile-filter.ts`

### Reminders not sending
- Verify cron job is configured
- Check `TELEGRAM_CHAT_ID` for reminders
- Review `reminder-scheduler.ts` logs

---

## Future Enhancements

1. **Manual Draft Editing:** Allow HITL to edit drafts before sending
2. **A/B Testing:** Send variant messages to different leads
3. **Analytics:** Track open rates, reply rates, conversion rates
4. **Persistence:** Move enrichment context to Redis for reliability
5. **Parallelization:** Process multiple leads simultaneously
6. **Webhook Retries:** Retry failed outreach sends
7. **AI Feedback Loop:** Learn from approved/rejected drafts

