# AimHigher AI Team — Complete Design Spec v1.0

**Date:** May 2026 | **Status:** Ready for Implementation | **Target:** Vercel MVP + Reference Architecture

---

## 1. VISION & OUTCOMES

### Primary Outcomes (All Three)
1. **Deploy-ready MVP** — One-click Vercel deployment with Groq + Airtable
2. **Reference architecture** — Clean, maintainable, well-documented codebase
3. **Full feature completeness** — All 4 agents fully functional with Strategic Scout

### Scope: MUST-HAVE Only
**Launch MVP:**
- Groq agents, Airtable persistence, Strategic Scout, Login + Auth
- Post-Launch: Role-based access, Snapshot detection, Slack notifications, status workflow

---

## 2. TECH STACK & ARCHITECTURE

### API Layer
- **LLM Provider:** Groq (replacing Anthropic)
  - Scout: `mixtral-8x7b-32768` (complex JSON, lead scoring)
  - Rex/Aria/Sage: `llama-2-70b-4096` (conversational, cost-optimized)
- **Data Store:** Airtable (18-field Leads table + Users table, full schema from AIRTABLE_SETUP.md)
- **Authentication:** Airtable Users table (email + password hash via bcrypt)
  - Session management: JWT tokens (stored in httpOnly cookies)
  - Future: Role-based access (v1.1)
- **Twitter Signals:** Xpoz API (live search + knowledge base fallback)
- **Server:** Next.js 14.2.3 (API routes proxy all credentials server-side)

### File Structure
```
aimhigher-team/
├── lib/
│   ├── types.ts              [NEW] Centralized TypeScript interfaces
│   ├── groq-client.ts        [NEW] Groq API wrapper
│   ├── agents.ts             [UPDATE] Prompts, KB, Scout queries
│   ├── airtable-client.ts    [NEW] Airtable CRUD wrapper
│   └── auth.ts               [NEW] JWT + session helpers
├── pages/
│   ├── login.tsx             [NEW] Login page
│   ├── index.tsx             [UPDATE] UI - add Lead type, save flow, auth guard
│   ├── _app.tsx              [UPDATE] Session provider, auth check
│   └── api/
│       ├── auth/
│       │   ├── login.ts       [NEW] Login endpoint
│       │   ├── logout.ts      [NEW] Logout endpoint
│       │   └── me.ts          [NEW] Current user endpoint
│       ├── chat.ts           [REWRITE] Groq proxy (replace Anthropic)
│       ├── scout.ts          [REWRITE] Xpoz + Groq scoring
│       └── leads.ts          [REWRITE] Airtable CRUD
├── .env.example              [UPDATE] Groq keys, Airtable vars, JWT secret
├── package.json              [UPDATE] Add groq-sdk, airtable, bcryptjs, jsonwebtoken
├── README.md                 [UPDATE] Groq setup, auth setup
├── DEPLOYMENT_CHECKLIST.md   [SIMPLIFY] Local test steps, Vercel flow
├── AIRTABLE_SETUP.md         [UPDATE] Add Users table schema
└── tsconfig.json             [KEEP]
```

---

## 3. DATA FLOW

### Authentication Flow
```
User visits app (no session)
  ↓
Redirected to /login
  ↓
User enters email + password
  ↓
POST /api/auth/login
  ├─ Query Airtable Users table for email
  ├─ bcrypt.compare(password, stored_hash)
  ├─ If match: create JWT, set httpOnly cookie
  └─ If no match: return { error: "Invalid credentials" }
  ↓
Redirect to /
  ↓
App loads → checks session cookie → displays main UI
  ↓
On logout: POST /api/auth/logout → clear cookie → redirect to /login

If session expires or missing:
  ↓
GET /api/auth/me returns 401
  ↓
Client redirects to /login automatically
```

### Scout Agent Flow
```
User clicks "Hunt Live Projects" 
  ↓
GET /api/scout (vertical, chain filters)
  ├─ [LIVE PATH] Call Xpoz API (live Twitter search)
  │   ↓
  │   Format tweets → send to Groq (mixtral-8x7b-32768)
  │   ↓
  │   Claude scores against Strategic Rubric (4 dimensions)
  │   ↓
  │   Parse JSON → filter fit_score >= 7
  │   ↓
  │   Return projects (source: 'live')
  │
  └─ [FALLBACK PATH] If Xpoz fails
      ↓
      Send Scout prompt + filter request to Groq
      ↓
      Claude generates projects from knowledge base
      ↓
      Return projects (source: 'knowledge')

User sees results + "Open in Outreach" / "Open in Onboarding" buttons
User clicks "Save lead" on selected projects
  ↓
POST /api/leads (Lead object with all 18 fields)
  ↓
Airtable creates record
  ↓
Toast: "Lead saved: ProjectName"
```

### Rex (Outreach) Agent Flow
```
User sends message to Rex
  ↓
POST /api/chat (agent: 'outreach', messages, context: optional project)
  ↓
Next.js sends to Groq (llama-2-70b-4096) with system prompt
  ↓
Rex responds with qualification question or close attempt
  ↓
User responds → repeats until fit_score >= 9
  ↓
If user mentions "ready" or "10 minutes":
  ├─ Auto-create lead in Airtable (status: 'qualified')
  └─ Toast: "Lead qualified! Check Airtable."
```

### Aria (Onboarding) & Sage (Q&A) Flows
```
User sends message
  ↓
POST /api/chat (agent: 'onboard' or 'qa')
  ↓
Next.js sends to Groq (llama-2-70b-4096)
  ↓
Agent responds step-by-step (Aria) or answers (Sage)
  ↓
Loop on user input
```

---

## 4. CORE MODULES

### lib/types.ts
```typescript
interface User {
  id: string
  email: string
  name: string
  password_hash: string
  created_at: string
  updated_at: string
  // Future: role: 'admin' | 'editor' | 'viewer'
}

interface Session {
  userId: string
  email: string
  name: string
  iat: number
  exp: number
}

interface Lead {
  id: string
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  why_good_fit: string
  pain_point: string
  estimated_treasury_size: string
  contact_handle: string
  source_signal: string
  snapshot_vote: string | null
  fit_score: number
  score_breakdown: ScoreBreakdown
  verdict: 'PREMIUM' | 'LEAD'
  hook: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'disqualified'
  notes?: string
  created_by: string         // user email
  created_at: string
  updated_at: string
}

interface ScoreBreakdown {
  sector_alpha: number
  sentiment_pain: number
  engagement_gap: number
  chain_momentum: number
}

interface Project {
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  why_good_fit: string
  pain_point: string
  estimated_treasury_size: string
  contact_handle: string
  source_signal: string
  snapshot_vote: string | null
  fit_score: number
  score_breakdown: ScoreBreakdown
  verdict: 'PREMIUM' | 'LEAD'
  hook: string
}
```

### lib/auth.ts
```typescript
// JWT helpers
// - createToken(user: User): string
// - verifyToken(token: string): Session | null
// - getSessionFromCookie(req: NextApiRequest): Session | null

// Password helpers
// - hashPassword(password: string): Promise<string>
// - verifyPassword(password: string, hash: string): Promise<boolean>

// Middleware
// - withAuth(handler: NextApiHandler): NextApiHandler
//   (checks session, returns 401 if missing)
```

### lib/groq-client.ts
```typescript
// Wrapper around @groq/sdk
// Methods:
//   - createChatCompletion(model, messages, system)
//   - parseJSON(text) with fallback cleanup
//   - Error handling + rate limit detection
```

### lib/airtable-client.ts
```typescript
// Wrapper around airtable npm package
// Methods:
//   - createLead(lead: Lead)
//   - getAllLeads(filters?: object)
//   - updateLead(id: string, updates: Partial<Lead>)
//   - deleteLead(id: string)
// Auto-formats Lead objects to Airtable field names
```

### lib/agents.ts (Update)
```typescript
// KEEP:
// - AIMHIGHER_KB
// - SCOUT_RUBRIC
// - AGENT_PROMPTS (all 4)
// - SCOUT_QUERIES
// - SUPPORTED_CHAINS
// - TARGET_MCAP, MIN_POOL_SIZE, etc.

// ADD:
// - GROQ_MODELS = { scout: 'mixtral-8x7b-32768', rex: 'llama-2-70b-4096', ... }
```

---

## 5. API ROUTES

### POST /api/auth/login
**Request:**
```json
{
  "email": "user@aimhigher.gg",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "user": {
    "id": "rec12345...",
    "email": "user@aimhigher.gg",
    "name": "Alice"
  }
}
```
(JWT set in httpOnly cookie: `session`)

**Response (Failure):**
```json
{
  "ok": false,
  "error": "Invalid email or password"
}
```

**Implementation:**
1. Validate input (email format, password non-empty)
2. Query Airtable Users table for email
3. If not found: return { ok: false, error: "Invalid email or password" }
4. If found: bcrypt.compare(password, password_hash)
5. If no match: return { ok: false, error: "Invalid email or password" }
6. If match: create JWT, set httpOnly cookie, return user data
7. Error: If Airtable fails, return { ok: false, error: "Authentication service error" }

---

### POST /api/auth/logout
**Request:** (no body)

**Response:**
```json
{
  "ok": true,
  "message": "Logged out"
}
```

**Implementation:**
1. Clear `session` cookie
2. Return success

---

### GET /api/auth/me
**Request:** (no body, requires session cookie)

**Response (Authenticated):**
```json
{
  "ok": true,
  "user": {
    "id": "rec12345...",
    "email": "user@aimhigher.gg",
    "name": "Alice"
  }
}
```

**Response (Not Authenticated):**
```json
{
  "ok": false,
  "error": "Not authenticated"
}
```

**Implementation:**
1. Check session cookie
2. Verify JWT
3. If valid: return user data
4. If invalid/missing: return 401 + error

---

### POST /api/chat
**Request:**
```json
{
  "agent": "scout" | "outreach" | "onboard" | "qa",
  "messages": [{ "role": "user" | "assistant", "content": "..." }],
  "systemOverride": "optional custom system prompt"
}
```

**Response:**
```json
{
  "text": "Agent response",
  "error": null
}
```

**Implementation:**
- **Require auth:** Check session cookie, return 401 if missing
- Load correct Groq model from GROQ_MODELS[agent]
- Load system prompt from AGENT_PROMPTS[agent]
- Call groq-client.createChatCompletion()
- Handle errors: mixed approach (graceful non-critical, clear critical)
- If Groq fails: return { text: "", error: "Groq API error: [reason]. Try again in 60s." }

---

### POST /api/scout
**Request:**
```json
{
  "vertical": "all" | "defi" | "gamefi" | "socialfi" | "rwa" | "launchpad" | "memecoin",
  "chain": "any chain" | "Base" | "Arbitrum" | "Solana" | "BNB" | "Ethereum" | "Polygon"
}
```

**Response:**
```json
{
  "projects": [{ project_name, token_ticker, chain, ..., fit_score, verdict }],
  "signalCount": 47,
  "source": "live" | "knowledge",
  "error": null
}
```

**Implementation:**
- **Require auth:** Check session cookie, return 401 if missing
1. Build Xpoz queries based on vertical/chain filters
2. Try live search:
   - Call Xpoz API (with XPOZ_API_KEY)
   - Format tweets → send to Groq (mixtral-8x7b-32768)
   - Parse JSON → filter fit_score >= 7
   - Return { projects, signalCount, source: 'live' }
3. If Xpoz fails → fallback to knowledge base:
   - Send Scout prompt (no tweet context) to Groq
   - Parse JSON → filter fit_score >= 7
   - Return { projects, signalCount: 0, source: 'knowledge' }
4. Error handling: If both fail, return { projects: [], error: "Scout failed..." }

---

### POST /api/leads
**Request (Create):**
```json
{
  "project_name": "...",
  "token_ticker": "...",
  ... (all 18 Lead fields, created_by filled from session)
}
```

**Response:**
```json
{
  "ok": true,
  "id": "rec12345...",
  "message": "Lead saved to Airtable"
}
```

**Implementation:**
- **Require auth:** Check session cookie, return 401 if missing
- Add created_by from session.email
- Validate required fields (project_name, token_ticker, chain, fit_score)
- Check env vars (AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_LEADS_TABLE_ID)
- Call airtable-client.createLead()
- Error: If Airtable unreachable, return { ok: false, error: "Airtable connection failed..." }

**Request (Get):**
```json
{ }
```

**Response:**
```json
{
  "leads": [{ id, project_name, chain, status, created_at, ... }],
  "count": 12
}
```

---

### GET /api/leads
**Response:**
```json
{
  "leads": [...],
  "count": 12
}
```

**Implementation:**
- Query Airtable (sorted by created_at desc)
- Map Airtable fields → Lead objects
- Return with count

---

### PATCH /api/leads
**Request:**
```json
{
  "id": "rec12345...",
  "status": "contacted",
  "notes": "Founder interested in 2-week campaign"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Lead updated"
}
```

---

### DELETE /api/leads
**Request:**
```json
{
  "id": "rec12345..."
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Lead deleted"
}
```

---

## 6. ERROR HANDLING STRATEGY (Mixed Approach)

### Non-Critical Failures (Hidden, allow user to continue)
- Scout fails to score 1-2 projects → show the ones that succeeded
- Xpoz search returns 0 results → use knowledge base fallback
- One Airtable field fails validation → save with partial data (if possible)

### Critical Failures (Show clear error, stop flow)
- Groq API completely down → "Groq API error: [reason]. Try again in 60s."
- GROQ_API_KEY missing or invalid → "Configuration error: GROQ_API_KEY not set"
- Airtable unreachable (403/404) → "Failed to save to Airtable. Check credentials in .env"
- Malformed JSON from Groq → "Error parsing response. Please try again."

### Error Display
- API errors: Toast notification + console log
- Server errors: JSON response with { error: "Human-readable message" }
- Network errors: Retry once, then show error

---

## 7. ENVIRONMENT VARIABLES

### Required (app refuses to start without these)
```bash
GROQ_API_KEY=gsk_...                          # From console.groq.com
AIRTABLE_PAT=pat_...                          # From airtable.com/account
AIRTABLE_BASE_ID=app...                       # From Airtable base URL
AIRTABLE_LEADS_TABLE_ID=tbl...                # From Airtable API docs
AIRTABLE_USERS_TABLE_ID=tbl...                # From Airtable API docs (Users table)
JWT_SECRET=your-secret-key-32-chars-min       # For signing JWT tokens (generate: openssl rand -base64 32)
```

### Optional (app works without these, features degrade)
```bash
XPOZ_API_KEY=...                              # From Xpoz dashboard (Scout fallback if missing)
XPOZ_API_BASE=https://mcp.xpoz.ai/mcp         # Default, can override
NEXT_PUBLIC_APP_URL=http://localhost:3000     # For client-side API calls
```

### Validation (in pages/api/chat.ts and pages/api/leads.ts)
```typescript
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY not set in environment")
}
if (!process.env.AIRTABLE_PAT || !process.env.AIRTABLE_BASE_ID) {
  throw new Error("Airtable credentials missing")
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET not set in environment")
}
```

---

## 8. UI UPDATES (pages/index.tsx)

### Changes
- Import Lead type from lib/types.ts
- Update Project interface → match Lead (add verdict, hook, score_breakdown)
- Scout results: add "Save lead" button (POST /api/leads)
- On save: show toast, clear button, mark as saved
- Outreach flow: auto-detect qualification, offer quick save to Airtable
- Error handling: show toast on API errors (graceful for non-critical)

---

## 9. DEPLOYMENT FLOW

### Airtable Setup: Users Table (NEW REQUIREMENT)
1. In your "AimHigher Leads" base, create a "Users" table with columns:
   - `id` (Text) — unique ID
   - `email` (Email) — required, unique
   - `name` (Text) — display name
   - `password_hash` (Long text) — bcrypt hash (never store plain password)
   - `created_at` (Created time) — auto
   - `updated_at` (Last modified time) — auto
   - Future: `role` (Select: admin/editor/viewer)

2. Add your user(s):
   ```
   id: rec_user_1
   email: you@aimhigher.gg
   name: Your Name
   password_hash: [hash of your password, use bcrypt online or npm script]
   ```

   Or use this Node.js script to generate a hash:
   ```bash
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10, (e,h) => console.log(h))"
   ```

3. Get the Users table ID from Airtable API docs

### Local Development
```bash
cp .env.example .env.local
# Fill in: GROQ_API_KEY, AIRTABLE_*, XPOZ_API_KEY
# Generate JWT_SECRET: openssl rand -base64 32
npm install
npm run dev
# Test: Login with your email/password → Scout → Airtable → Logout
```

### Test Checklist (5-10 min)
- [ ] Visit /login → enters email/password
- [ ] Login succeeds → redirected to main app
- [ ] Scout finds ≥3 projects (live or fallback)
- [ ] Click "Save lead" → appears in Airtable with created_by filled
- [ ] Send message to Rex → gets qualification question
- [ ] Send message to Aria → gets step 1 of 8
- [ ] Send message to Sage → gets answer
- [ ] Click logout → redirected to /login
- [ ] No session cookie → redirected to /login (can't access app)
- [ ] No 401/403/500 errors in console

### Vercel Deployment
```bash
vercel
# Follow prompts, link GitHub repo
# In Vercel dashboard: Settings → Environment Variables
# Add: GROQ_API_KEY, AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_LEADS_TABLE_ID, XPOZ_API_KEY
vercel --prod
```

### Post-Deploy Test
- Visit app URL → loads
- Run Scout → verify live or fallback
- Save lead → check Airtable base
- No API errors in Vercel logs

---

## 10. DOCUMENTATION UPDATES

### .env.example
```bash
# Groq
GROQ_API_KEY=gsk_...

# Airtable
AIRTABLE_PAT=pat_...
AIRTABLE_BASE_ID=app...
AIRTABLE_LEADS_TABLE_ID=tbl...

# Xpoz (optional, Scout works without it)
XPOZ_API_KEY=...
XPOZ_API_BASE=https://mcp.xpoz.ai

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### README.md
- Replace Anthropic setup → Groq setup
- Update: "Get your Groq API key from console.groq.com (free tier, very fast)"
- Keep Airtable, Xpoz sections (already good)
- Add: "Groq models used: Scout=mixtral-8x7b-32768, others=llama-2-70b-4096"

### DEPLOYMENT_CHECKLIST.md
- Simplify to focus on Groq + Airtable (remove old Anthropic steps)
- Add local test checklist (5 min)
- Vercel flow: same, just different env vars
- Post-deploy testing

### AIRTABLE_SETUP.md
- Keep as-is (already complete and correct)

---

## 11. TESTING STRATEGY

### Unit Tests (Optional for MVP, add post-launch)
- groq-client.ts: mock Groq API, test JSON parsing
- airtable-client.ts: mock Airtable API, test CRUD
- agents.ts: verify prompts compile, no missing vars

### Integration Tests (Manual, required for launch)
- Scout: live Xpoz → Groq scoring → JSON parse
- Scout fallback: no Xpoz → knowledge base → JSON parse
- Rex: multi-turn conversation → lead qualification
- Aria: 8-step onboarding flow
- Sage: Q&A from knowledge base
- Airtable: create → read → update → delete

---

## 12. SUCCESS CRITERIA

✅ **MUST-HAVE (Launch Day)**
- **Authentication:** Login page works, JWT session management, logout
- **Airtable Users table:** Setup with email + password_hash, auth checks work
- Scout finds projects with fit_score >= 7 (live or fallback)
- User can save leads to Airtable with all 18 fields (created_by auto-filled)
- Rex, Aria, Sage respond correctly via Groq (auth protected)
- No API keys exposed to browser, all proxied server-side
- Env validation prevents misconfiguration
- Deployer can go: get Groq key + set up Users table → set env vars → vercel --prod → works

✅ **REFERENCE ARCHITECTURE**
- Types centralized (lib/types.ts including User + Session)
- Groq wrapper abstracted (lib/groq-client.ts)
- Airtable wrapper abstracted (lib/airtable-client.ts)
- Auth module abstracted (lib/auth.ts with JWT + password helpers)
- API routes clean and focused (auth middleware on protected routes)
- Error handling consistent (mixed approach)
- README explains the whole system + auth setup in 10 min read

✅ **FEATURE COMPLETE (All 4 Agents + Auth)**
- Scout: Strategic Rubric scoring (4 dimensions), live + fallback, auth protected
- Rex: Qualification flow, auto-detect ready-to-close, auth protected
- Aria: 8-step onboarding guide, auth protected
- Sage: Knowledge base Q&A, auth protected
- Auth: Login/logout, JWT session, Airtable Users table

---

## 13. POST-LAUNCH ROADMAP (Not in MVP)

- [ ] Snapshot governance vote detection (auto-score 10)
- [ ] Slack notifications for Premium leads
- [ ] Lead status workflow UI (new → contacted → converted)
- [ ] Custom outreach templates per vertical
- [ ] Real-time lead dashboard
- [ ] Bulk lead operations (export, tag, re-score)

---

## 14. CODE STYLE & STANDARDS

- **TypeScript:** strict mode, no `any`, use interfaces from lib/types.ts
- **Formatting:** 2-space indent, max 100 chars per line
- **Comments:** Only explain *why*, not *what* (code shows what)
- **Error messages:** User-facing (clear, actionable), not stack traces
- **API responses:** Always { ok, data, error } structure or specific success schema
- **Env vars:** Validate at startup, fail loudly if missing (required)

---

## FINAL CHECKLIST

- [x] Tech stack finalized (Groq models chosen)
- [x] Data flow documented (Scout → Rex → Aria → Sage → Airtable)
- [x] File structure defined
- [x] API contracts specified
- [x] Error handling strategy locked (mixed approach)
- [x] Env var strategy clear
- [x] Deployment flow (local + Vercel)
- [x] Success criteria defined
- [x] Documentation update plan

**Ready to implement.**
