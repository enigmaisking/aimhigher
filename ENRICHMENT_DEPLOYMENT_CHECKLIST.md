# Implementation Checklist - Lead Enrichment Workflow

## Pre-Deployment

### Code Review
- [ ] Review all 6 new files in `src/lib/autonomy/`
- [ ] Check modified `orchestrator.ts` handles enrichment callbacks
- [ ] Verify `telegram-client.ts` extends correctly
- [ ] Test all TypeScript compilation (`npm run build`)
- [ ] Run existing tests (no breaking changes expected)

### Environment & Configuration
- [ ] Confirm `.env.local` has `TELEGRAM_BOT_TOKEN`
- [ ] Confirm `.env.local` has `TELEGRAM_CHAT_ID` (your team's chat)
- [ ] Confirm `.env.local` has `GROQ_API_KEY`
- [ ] Confirm all `AIRTABLE_*` variables configured
- [ ] Verify `CRON_SECRET` set for cron jobs
- [ ] Test GeckoTerminal API is accessible (`curl https://api.geckoterminal.com/api/v3/networks/solana/tokens/...`)

### Airtable Setup
- [ ] Add field: `enrichment_step` (Single select) with options:
  - awaiting_group_join
  - running_profile_filter
  - generating_draft
  - awaiting_approval
  - completed
  - skipped
- [ ] Add field: `social_links_json` (Long text)
- [ ] Add field: `target_audience_json` (Long text)
- [ ] Add field: `outreach_draft` (Long text)
- [ ] Add field: `onboarding_draft` (Long text)

### Telegram Bot Configuration
- [ ] Verify bot has admin rights in team chat
- [ ] Verify bot can send messages, buttons, and media
- [ ] Test bot responds to commands: `/start`, `/help`
- [ ] Verify webhook URL is correct in BotFather

---

## Deployment

### Step 1: Deploy New Files
```bash
# Verify no lint errors
npm run lint

# Build to check for TypeScript errors
npm run build

# Deploy (your deployment method)
git add src/lib/autonomy/*.ts ENRICHMENT_*.md
git commit -m "feat: add lead enrichment workflow with GeckoTerminal social links and LLM drafts"
git push
```

### Step 2: Set Up Cron Job
- [ ] Create `pages/api/cron/reminders.ts` (see Quick Start guide)
- [ ] Update `vercel.json` with cron config
- [ ] Deploy and verify cron is scheduled in Vercel dashboard

### Step 3: Update Webhook
- [ ] No changes needed - existing webhook handles new callbacks automatically
- [ ] Verify webhook is still active and receiving callbacks

---

## Testing

### Unit Tests
```bash
# Create test file: __tests__/enrichment.test.ts
npm run test -- enrichment.test.ts
```

Test items:
- [ ] `fetchGeckoTerminalSocialLinks()` returns proper format
- [ ] `enrichWithSocialLinks()` caches context
- [ ] `runProfileFilter()` identifies high-value profiles
- [ ] `generateOutreachDraft()` returns non-empty message
- [ ] `answerLeadQuestion()` provides sensible answers
- [ ] `shouldSendReminder()` timing is correct

### Integration Tests
- [ ] Create test lead in Airtable
- [ ] Call `enrichWithSocialLinks()` manually
- [ ] Verify Telegram message sent with correct buttons
- [ ] Click "✅ Confirmed Joined" button in Telegram
- [ ] Check logs for profile filtering execution
- [ ] Verify draft message sent to Telegram
- [ ] Click "✅ Approve & Send" button
- [ ] Check Airtable lead status updated to "contacted"

### End-to-End Test (Full Workflow)
1. [ ] Run scout to generate leads (fit_score ≥ 7)
2. [ ] HITL receives Telegram card with "Hand Off" button
3. [ ] HITL clicks "Hand Off to Outreach"
4. [ ] **Step 1:** Social links appear in Telegram
5. [ ] HITL clicks "✅ Confirmed Joined"
6. [ ] Wait 60 seconds for profile filtering (check logs)
7. [ ] Draft message appears in Telegram
8. [ ] HITL clicks "✅ Approve & Send"
9. [ ] Verify:
   - [ ] Outreach DM sent to project (check X DMs)
   - [ ] Airtable status changed to "contacted"
   - [ ] Lead moved out of enrichment queue

### Reminder Test
- [ ] Wait for first lead to be in `awaiting_approval` for >1 hour
- [ ] Manually trigger cron: `curl https://your-site.com/api/cron/reminders?auth=...`
- [ ] Verify reminder message sent to Telegram
- [ ] Check reminder count incremented in logs

### Edge Cases
- [ ] Test with lead that has no social links
- [ ] Test with project that has invalid X/Telegram handles
- [ ] Test HITL clicking "Skip" at various steps
- [ ] Test HITL clicking "Edit Draft" (logs error, no crash)
- [ ] Test 3 reminders then auto-skip
- [ ] Test parallel leads in enrichment queue

---

## Monitoring (First Week)

### Daily Checks
- [ ] Check Telegram bot logs for errors
- [ ] Verify reminders sending on schedule (check timestamps)
- [ ] Monitor Airtable for stalled leads (stuck in "awaiting_approval")
- [ ] Check Groq API usage (ensure not rate-limited)
- [ ] Review any failed GeckoTerminal lookups

### Performance Metrics
- [ ] Average time: Step 1 (social links): <2 seconds
- [ ] Average time: Step 2 (await confirmation): varies (HITL speed)
- [ ] Average time: Step 3 (profile filtering): 30-60 seconds
- [ ] Average time: Step 4 (draft generation): 15-30 seconds
- [ ] Average time: Step 5 (await approval): varies (HITL speed)
- [ ] Average time: Step 6 (send outreach): <5 seconds

### Success Rate Targets
- [ ] Social links fetched: >95%
- [ ] Profiles identified: 100% (if group has members)
- [ ] Drafts generated: >98% (rarely fails)
- [ ] HITL approval rate: Track (sets baseline for future optimization)

---

## Rollback Plan

If something breaks:

1. [ ] Disable enrichment workflow immediately:
   - Comment out enrichment trigger in HITL callback handler
   - Leads will use original "approve" flow (backwards compatible)

2. [ ] Investigate in logs:
   - Search for "[DraftGenerator]" for LLM issues
   - Search for "[ProfileFilter]" for audience analysis issues
   - Search for "[GeckoTerminal]" for API issues
   - Search for "[Reminder" for cron issues

3. [ ] Hot fixes (if needed):
   - Adjust LLM `maxTokens` in `draft-generator.ts`
   - Update GeckoTerminal chain mappings
   - Disable reminders by removing cron job
   - Increase reminder intervals

4. [ ] Rollback (if needed):
   - Remove enrichment files
   - Revert `orchestrator.ts` and `telegram-client.ts` changes
   - Deploy previous version
   - Alert HITL team of temporary workflow change

---

## Documentation Checklist

- [ ] Share `ENRICHMENT_QUICK_START.md` with team
- [ ] Share `ENRICHMENT_WORKFLOW.md` with engineering team
- [ ] Create Slack channel: `#enrichment-workflow`
- [ ] Post workflow diagram to channel
- [ ] Document common questions in FAQ
- [ ] Create admin guide for monitoring alerts

---

## User Training

### For HITL Team
- [ ] Send demo video of enrichment workflow
- [ ] Explain when "Hand Off" is available vs. automatic handoff
- [ ] Demo Q&A feature for answering their questions
- [ ] Explain reminder system (won't be abandoned)
- [ ] Show how to edit drafts if needed
- [ ] Provide troubleshooting phone number/Slack

### For Engineering Team
- [ ] Walkthrough of 6 new files and their roles
- [ ] Explain enrichment state machine
- [ ] Show debugging commands (cache stats, reminder stats)
- [ ] Document how to extend with custom logic
- [ ] Point to full architecture doc

---

## Post-Deployment (Week 1-2)

### Observations
- [ ] Track HITL feedback: Which steps are bottlenecks?
- [ ] Track rejection rate: Why are drafts rejected?
- [ ] Track response rate: Do enriched outreach get better responses?
- [ ] Track time to completion: How long is full workflow taking?

### Optimizations (if needed)
- [ ] Reduce draft generation latency (cache?, different model?)
- [ ] Improve profile filtering accuracy (adjust thresholds?)
- [ ] Add more Q&A templates based on HITL questions
- [ ] Adjust reminder intervals based on HITL behavior

### Success Metrics
- [ ] All enrichment workflows complete end-to-end ✓
- [ ] Zero crashes or unhandled errors ✓
- [ ] Reminders working as expected ✓
- [ ] HITL satisfaction > 4/5 ✓
- [ ] Response rate to outreach improved vs. baseline ✓

---

## Long-term Roadmap

### Phase 2 (Months 2-3)
- [ ] Add draft editing UI (not just approve/skip)
- [ ] Implement A/B testing (send variant messages)
- [ ] Add analytics dashboard (response rates, conversions)
- [ ] Scale to multiple projects simultaneously

### Phase 3 (Months 3-4)
- [ ] Move to Redis for enrichment persistence
- [ ] Add webhook retries for failed outreach
- [ ] Implement lead deduplication
- [ ] Add support for other blockchains dynamically

### Phase 4 (Months 4+)
- [ ] AI feedback loop: Learn from rejected drafts
- [ ] Predictive lead scoring based on responses
- [ ] Automated follow-up sequences
- [ ] Integration with CRM (HubSpot, Pipedrive, etc.)

---

## Support & Questions

**For technical issues:**
- Check logs in vercel dashboard
- Review error messages in Airtable
- Check Telegram bot debug logs

**For workflow questions:**
- See `ENRICHMENT_WORKFLOW.md`
- See `ENRICHMENT_QUICK_START.md`
- Ask engineering team in #enrichment-workflow Slack

**For HITL user issues:**
- Direct to Quick Start guide
- Record a demo for new team members
- Gather feedback for UX improvements

---

## Sign-Off

- [ ] Engineering Lead: _________________ Date: _____
- [ ] Product Lead: _________________ Date: _____
- [ ] Operations/HITL Lead: _________________ Date: _____

