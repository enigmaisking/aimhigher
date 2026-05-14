# 🚀 AimHigher AI Team — Deployment Checklist v1.0

**Status:** Ready for production deployment  
**Time:** ~30 minutes from start to Vercel live  

---

## ✅ PRE-DEPLOYMENT (LOCAL)

### 1. Copy Files (5 min)
- [ ] Copy all files from `/home/claude/` to your project (see HANDOFF.md for mapping)
- [ ] Directories created: `lib/`, `pages/api/auth/`
- [ ] Old files deleted: `data/leads.json` (Airtable replaces it)

### 2. Install Dependencies
```bash
npm install
```
- [ ] Package.json updated with: groq-sdk, airtable, bcryptjs, jsonwebtoken, cookie

### 3. Airtable Setup (10 min)
**Create two tables in your "AimHigher Leads" base:**

**Leads table** — 18 columns:
```
id, project_name, token_ticker, chain, contract_address, estimated_mcap,
why_good_fit, pain_point, estimated_treasury_size, contact_handle,
source_signal, snapshot_vote, fit_score, score_breakdown_json,
verdict, hook, status, created_by, notes
```

**Users table** — 4 columns:
```
id, email, name, password_hash
```

Get Airtable credentials:
- [ ] PAT from https://airtable.com/account/personal/developers (scopes: data.records:read/write, schema.bases:read)
- [ ] Base ID from URL: `airtable.com/appXXXXXXXXXXXXXX/...`
- [ ] Table IDs from API docs

### 4. Add First User to Airtable Users Table
```bash
# Generate bcrypt hash:
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10, (e,h) => console.log(h))"
```

Create record in Users table:
```
id: rec_user_1
email: you@aimhigher.gg
name: Your Name
password_hash: [hash from above]
```

### 5. Environment Variables
```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```bash
GROQ_API_KEY=gsk_[from console.groq.com]
AIRTABLE_PAT=pat_[from Airtable]
AIRTABLE_BASE_ID=app[from URL]
AIRTABLE_LEADS_TABLE_ID=tbl[from API docs]
AIRTABLE_USERS_TABLE_ID=tbl[from API docs]
JWT_SECRET=[openssl rand -base64 32]
XPOZ_API_KEY=[optional, from Xpoz]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Local Testing (5 min)
```bash
npm run dev
# Visit http://localhost:3000 → redirects to /login
```

Test checklist:
- [ ] Login page loads
- [ ] Login with your email/password works
- [ ] Redirected to main app
- [ ] Scout: "Hunt Live Projects" finds projects
- [ ] Scout: "Save Lead" creates Airtable record
- [ ] Outreach: Send message → Rex responds
- [ ] Onboarding: Send message → Aria responds
- [ ] Q&A: Send message → Sage responds
- [ ] Logout works → redirected to /login
- [ ] Try /api/chat without login → 401 error (good!)
- [ ] No errors in console

---

## 🌐 DEPLOYMENT TO VERCEL

### 1. GitHub Setup
```bash
git init
git add .
git commit -m "Initial commit: AimHigher AI Team"
git remote add origin https://github.com/your-org/aimhigher-team.git
git push -u origin main
```
- [ ] Repo created and pushed

### 2. Vercel Setup
```bash
npm install -g vercel
vercel
```
- [ ] Vercel CLI logged in
- [ ] GitHub repo linked
- [ ] Project confirmed: "aimhigher-ai-team"
- [ ] Framework auto-detected: "Next.js"

### 3. Add Environment Variables
**Vercel Dashboard → Settings → Environment Variables**

Add all required vars:
```
GROQ_API_KEY=gsk_...
AIRTABLE_PAT=pat_...
AIRTABLE_BASE_ID=app...
AIRTABLE_LEADS_TABLE_ID=tbl...
AIRTABLE_USERS_TABLE_ID=tbl...
JWT_SECRET=[your-secret-32-chars]
XPOZ_API_KEY=...
NEXT_PUBLIC_APP_URL=https://[your-vercel-url].vercel.app
```

- [ ] All 8 vars added
- [ ] No typos in var names

### 4. Deploy
```bash
vercel --prod
```
- [ ] Build succeeds (check Vercel logs)
- [ ] Deployment completes
- [ ] URL provided

### 5. Post-Deploy Testing
Visit your Vercel URL:
- [ ] Login page loads
- [ ] Login works with your credentials
- [ ] Scout finds projects
- [ ] Save lead → appears in Airtable
- [ ] All 4 agents respond correctly
- [ ] Logout works
- [ ] No 401/403/500 errors in Vercel dashboard logs

---

## 🔐 SECURITY CHECKLIST

- [ ] API keys NEVER in git (only in .env.local + Vercel env vars)
- [ ] `.env.local` added to `.gitignore` ✓ (already configured)
- [ ] Groq/Airtable keys never reach browser (all proxied via Next.js)
- [ ] JWT secret > 32 characters
- [ ] All protected routes use `withAuth()` middleware
- [ ] Password hashing: bcryptjs on password set, bcryptjs.compare on login
- [ ] Session cookie: httpOnly, SameSite=Lax, 7-day expiry

---

## 📊 POST-LAUNCH MONITORING

### Week 1
- [ ] Check Vercel dashboard for errors (Deployments → Logs)
- [ ] Check Anthropic API usage (console.anthropic.com)
- [ ] Add 1-2 more users to Airtable, verify they can login
- [ ] Monitor Airtable for lead data quality

### Week 2
- [ ] Review Scout results: are projects real? (fit_score >= 7)
- [ ] Check conversion rate: leads → contacted → qualified
- [ ] Spot-check Rex conversations: are they qualifying correctly?
- [ ] Monitor Groq API usage (shouldn't hit rate limits on free tier)

### Month 1
- [ ] Calculate ROI: (Converted Deals × Deal Value) / API Costs
- [ ] Analyze Scout scoring: which dimension drives conversions?
- [ ] Review Scout queries: any patterns missed?
- [ ] Plan v1.1 features (Snapshot detection, Slack, roles)

---

## 🐛 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "GROQ_API_KEY not configured" | Check .env.local (local) or Vercel env vars (prod) |
| "Airtable API key invalid" | Verify PAT (pat_), not old API key. Check scopes: data.records:read/write, schema.bases:read |
| "Failed to save lead" | Verify Leads table has all 18 columns. Check AIRTABLE_LEADS_TABLE_ID. |
| "Login fails" | Verify Users table exists. Check email + password_hash in Airtable. Try exact email match (case-sensitive). |
| "Scout returns no projects" | Check GROQ_API_KEY is valid. Xpoz is optional (fallback uses knowledge base). Try Groq console.groq.com to test API key. |
| "Build fails on Vercel" | Run `npm run build` locally first. Fix any TypeScript errors: `npx tsc --noEmit`. Check Vercel logs. |
| "Session expires too fast" | JWT expiry is 7 days. If shorter, check JWT_SECRET in env vars (might be getting truncated). |

---

## 📞 SUPPORT

**Before emailing support:**
1. Check browser console for error messages
2. Check Vercel deployment logs
3. Verify all env vars are set (don't assume defaults)
4. Try locally first (`npm run dev`)
5. Check README.md and HANDOFF.md

**If you find a bug:**
- Note the exact error message
- Screenshot the console
- Describe what you were doing when it happened
- Check if it happens locally and on Vercel

---

## ✅ FINAL SIGN-OFF

Before marking as "live," verify:

- [x] All files copied from /home/claude/ to your project
- [x] Dependencies installed (`npm install`)
- [x] Airtable base + tables created with correct columns
- [x] Airtable Users table has at least 1 user (you)
- [x] .env.local has all 6 required vars (GROQ_API_KEY, AIRTABLE_*, JWT_SECRET)
- [x] Local tests pass (login, Scout, save lead, all agents)
- [x] GitHub repo created and pushed
- [x] Vercel deployed with all env vars set
- [x] Post-deploy tests pass (login, Scout, Airtable, agents)
- [x] No 401/403/500 errors in logs

**You're ready to ship.** 🚀

---

**Deployment Time:** ~30 minutes  
**Status:** ✅ Ready for production  
**Next Review:** After week 1 of live usage  
