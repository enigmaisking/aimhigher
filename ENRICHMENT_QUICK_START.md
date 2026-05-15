# Lead Enrichment Workflow - Quick Start Guide

## What Was Built

A **multi-step HITL (Human-In-The-Loop) lead enrichment system** that enhances lead quality before outreach. When a lead is "handed off to outreach," the system:

1. Fetches project social links from GeckoTerminal
2. Asks HITL to join the project's Telegram group and follow their X account
3. Analyzes group members to identify high-value targets
4. Generates personalized outreach and onboarding messages using LLM
5. HITL reviews and approves before sending
6. Sends enriched outreach automatically

---

## Key Files Created

| File | Purpose |
|------|---------|
| `src/lib/autonomy/geckoterminal-enrich.ts` | Fetch social links from GeckoTerminal API |
| `src/lib/autonomy/lead-enrichment-handler.ts` | Manage enrichment workflow state |
| `src/lib/autonomy/profile-filter-runner.ts` | Wrapper for profile-filter.ts |
| `src/lib/autonomy/draft-generator.ts` | Generate outreach/onboarding messages |
| `src/lib/autonomy/qa-handler.ts` | Answer HITL questions |
| `src/lib/autonomy/reminder-scheduler.ts` | Send follow-up reminders |
| `ENRICHMENT_WORKFLOW.md` | Full integration guide |

---

## Implementation Steps

### Step 1: Update Environment Variables
Nothing new required - your existing config should work:
- `TELEGRAM_BOT_TOKEN` ✓
- `TELEGRAM_CHAT_ID` ✓
- `GROQ_API_KEY` ✓
- `AIRTABLE_*` ✓

### Step 2: Add Airtable Fields
Add these fields to your Leads table in Airtable:

```
enrichment_step        → Single select (awaiting_group_join, running_profile_filter, generating_draft, awaiting_approval, completed, skipped)
social_links_json      → Long text
target_audience_json   → Long text
outreach_draft         → Long text
onboarding_draft       → Long text
```

### Step 3: Trigger Enrichment When HITL Clicks "Hand Off"
In your HITL callback handler, add:

```typescript
import { enrichWithSocialLinks } from '@/lib/autonomy/lead-enrichment-handler'
import { formatGroupJoinRequest, sendGroupJoinRequest } from '@/lib/autonomy/telegram-client'

// When HITL clicks "Hand Off to Outreach" on a lead:
const context = await enrichWithSocialLinks(
  leadId,
  lead.project_name,
  lead.contract_address,
  lead.chain
)

const message = await formatGroupJoinRequest(context, process.env.TELEGRAM_CHAT_ID!)
await sendGroupJoinRequest(leadId, lead.project_name, message)
```

### Step 4: Add Reminder Cron Job
Create `pages/api/cron/reminders.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { processReminderQueue } from '@/lib/autonomy/reminder-scheduler'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify Vercel cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const result = await processReminderQueue()
  return res.status(200).json(result)
}
```

Update `vercel.json`:
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

### Step 5: Handle Enrichment Callbacks
The existing webhook (`pages/api/webhooks/telegram.ts`) already routes enrichment callbacks! 

When HITL clicks buttons like "✅ Confirmed Joined", it sends:
- `enrich_group_confirmed_{leadId}` → orchestrator handles next step
- `enrich_draft_approve_{leadId}` → sends outreach DM
- `enrich_skip_{leadId}` → marks lead as skipped

---

## How HITL Uses It

### HITL Flow:
1. **Receives Telegram card** with lead details (Scout result)
2. **Clicks "Hand Off to Outreach"** button
3. **Receives message** with project social links → joins group + follows X
4. **Clicks "✅ Confirmed Joined"** button
5. **System analyzes** group members in background (30-60 seconds)
6. **Receives draft message** with outreach preview + onboarding guide
7. **Reviews and clicks**:
   - ✅ **Approve & Send** → Message sent to project immediately
   - ✏️ **Edit Draft** → Make changes and re-send for approval
   - ⏭️ **Skip** → Discard this lead, move to next

### If HITL Doesn't Act:
- **After 1 hour:** Reminder #1 sent
- **After 2 hours:** Reminder #2 sent  
- **After 4 hours:** Reminder #3 sent
- **After 4+ hours:** Auto-skipped (configurable)

---

## Example Workflow Output

### Step 1: Social Links Fetched
```
🔗 Lead Enrichment: MoonShot Protocol

Please join their community and follow their socials to gather target audience intel:

🐦 Twitter/X: [Visit](https://twitter.com/moonshot_proto)
✈️ Telegram: [Join](https://t.me/moonshot_main)
💬 Discord: [Join](https://discord.gg/moonshot)
🌐 Website: [Visit](https://moonshot.dev)

[✅ Confirmed Joined] [⏭️ Skip]
```

### Step 3: Target Audience Identified
```
📊 Group Analysis: MoonShot Community

Total members scanned: 243
🥇 High-value targets: 12
🥈 Medium-value: 34

🏷️ Top target profiles: ADMIN, KOL, INFLUENCER, DEV

Top 5 High-Value Members:
  • @founder_mike (85pts) - FOUNDER, ADMIN
  • @kol_sarah (78pts) - KOL, VERIFIED_X
  • @dev_alex (72pts) - DEV, ADMIN
  • @influencer_jane (68pts) - INFLUENCER, ALPHA
  • @mod_james (65pts) - ADMIN, COMMUNITY_LEAD
```

### Step 4: Draft Generated
```
✏️ Review Draft for MoonShot Protocol

The LLM has generated a personalized outreach message based on the target audience profile.

📝 Outreach Message:
```
Hey! I noticed MoonShot is tackling liquidity fragmentation across chains. 
AimHigher lets you reward community members for driving real on-chain capital. 
Would you be open to a quick chat about setting up a pilot pool?
```

🎓 Onboarding Message:
```
Welcome to AimHigher! Here's how to get started:
1. Connect your wallet (5 min)
2. Create your first reward pool (10 min)
3. Share with your top contributors
4. Watch on-chain verification rewards happen automatically

Questions? Our team is in #support anytime!
```

[✅ Approve & Send] [✏️ Edit Draft] [⏭️ Skip Lead]
```

---

## Testing the Workflow

### Manual Testing
1. Create a test lead in Airtable
2. Call enrichment directly:
```typescript
import { enrichWithSocialLinks } from '@/lib/autonomy/lead-enrichment-handler'

const context = await enrichWithSocialLinks(
  'rec_test_123',
  'Test Project',
  '0x...',
  'solana'
)
console.log(context)
```

3. Check Telegram for group join request
4. Click confirmation button
5. Monitor logs for profile filtering
6. Check for draft message in Telegram

### Automated Testing
```typescript
import { runProfileFilter } from '@/lib/autonomy/profile-filter-runner'
import { generateFullDraft } from '@/lib/autonomy/draft-generator'

// Test profile filtering
const filterResult = await runProfileFilter(
  'test_lead',
  12345,
  'Test Group',
  mockProfiles
)

// Test draft generation
const draft = await generateFullDraft('test_lead', {
  projectName: 'Test',
  chain: 'solana',
  painPoint: 'Liquidity fragmentation',
  hook: 'Reward-based capital flow',
  verdict: 'PREMIUM',
  targetAudienceTags: ['ADMIN', 'KOL'],
  targetAudienceCount: 12,
})
```

---

## Monitoring & Debugging

### Check Enrichment Status
```typescript
import { getCachedContext, getCacheStats } from '@/lib/autonomy/lead-enrichment-handler'

// Check single lead
const context = getCachedContext('rec_123')
console.log(context.currentStep) // awaiting_group_join, etc.

// Check all in-flight leads
const stats = getCacheStats()
console.log(stats)
// { total: 5, byStep: { awaiting_group_join: 2, generating_draft: 3 } }
```

### Check Reminder Status
```typescript
import { getReminderStats } from '@/lib/autonomy/reminder-scheduler'

const stats = getReminderStats()
console.log(stats)
// { total: 3, byStep: { awaiting_approval: 3 }, averageReminders: 1.2 }
```

### Check Airtable
Query your Leads table filtered by `enrichment_step != "completed"` to see all in-progress enrichments.

---

## Common Issues & Solutions

### "GeckoTerminal returns empty social links"
→ Verify contract address format (lowercase, no 0x prefix for Solana)
→ Try looking up project manually on GeckoTerminal

### "Telegram bot doesn't send group join message"
→ Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars
→ Verify bot has write permissions in team chat

### "Profile filter finds no high-value members"
→ Verify bot is member of Telegram group
→ Lower SCORE_THRESHOLDS in `profile-filter.ts` if needed
→ Check group has enough members

### "LLM drafts are too generic"
→ Refine system prompts in `draft-generator.ts`
→ Add more context about the project to the prompt
→ Use different Groq models

---

## Next Steps

1. **Add the new fields** to your Airtable Leads table
2. **Deploy the code** - no breaking changes to existing functionality
3. **Set up reminder cron** - schedule the `reminders` cron job
4. **Test end-to-end** - use the manual testing guide above
5. **Monitor logs** - watch for errors in first week

---

## Architecture Overview

```
Scout finds lead
    ↓
HITL clicks "Hand Off"
    ↓
[Step 1] GeckoTerminal API → Social links
    ↓
[Step 2] HITL joins group (manual action)
    ↓
[Step 3] Profile-filter → Target audience (auto)
    ↓
[Step 4] Groq LLM → Drafts (auto)
    ↓
[Step 5] HITL approves (manual action)
    ↓
[Step 6] Send outreach DM (auto)
```

**Reminders run every hour** via cron to nudge HITL if steps aren't completed.

---

## Key Improvements

✅ **Higher quality outreach** - Personalized per project & audience
✅ **Better targeting** - Identifies high-value community members
✅ **Faster HITL process** - Clear, actionable interface
✅ **Intelligent follow-ups** - Automatic reminders prevent lost leads
✅ **Better context** - Existing profile-filter.ts reused
✅ **Production-ready** - All error handling & logging included
✅ **Backward compatible** - Existing lead workflow untouched

