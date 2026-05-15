# AimHigher AI Team

A production-ready AI agent suite for AimHigher (aimhigher.gg) — scout, qualify, onboard, and answer questions for Web3 project founders.

**Now with Groq LLM integration, JWT authentication, and Airtable persistence.**

---

## What's Inside

| Agent                    | Role                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| 🔍 **Scout**             | Hunts Twitter via Xpoz for live KOL-frustration signals and new project launches |
| 🎯 **Rex (Outreach)**    | Qualifies founders one question at a time, closes to campaign setup              |
| 🚀 **Aria (Onboarding)** | Walks founders step-by-step from wallet connect to funded live pool              |
| ⚡ **Sage (Q&A)**        | Answers any AimHigher question instantly                                         |

---

## Architecture

```
Browser (Next.js)
  ↓ POST /api/chat         → Groq API (key secured server-side)
  ↓ POST /api/scout        → Xpoz Twitter Search → Groq API
  ↓ POST /api/leads        → Airtable (CRUD with user attribution)
  ↓ POST /api/auth/login   → Airtable Users table (JWT session)

**The Groq and Airtable API keys NEVER reach the browser.**
All API calls are proxied through Next.js API routes.
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Airtable (5 minutes)

1. Create a free Airtable workspace: https://airtable.com
2. Create a base called "AimHigher Leads"
3. Create two tables:

   **Leads table** (with these columns):
   - `id` (Text)
   - `project_name` (Text)
   - `token_ticker` (Text)
   - `chain` (Single select: Base, Arbitrum, Solana, BSC, Ethereum, Polygon)
   - `contract_address` (Text)
   - `estimated_mcap` (Text)
   - `why_good_fit` (Long text)
   - `pain_point` (Text)
   - `estimated_treasury_size` (Text)
   - `contact_handle` (Text)
   - `source_signal` (Long text)
   - `snapshot_vote` (URL)
   - `fit_score` (Number)
   - `score_breakdown_json` (Long text)
   - `verdict` (Single select: PREMIUM, LEAD)
   - `hook` (Long text)
   - `status` (Single select: new, contacted, qualified, converted, disqualified)
   - `created_by` (Text)
   - `notes` (Long text)

   **Users table** (with these columns):
   - `id` (Text)
   - `email` (Email)
   - `name` (Text)
   - `password_hash` (Long text)

4. Get your Airtable credentials:
   - Go to https://airtable.com/account/personal/developers
   - Create a Personal Access Token (PAT) with scopes: `data.records:read/write`, `schema.bases:read`
   - Copy Base ID from URL: `airtable.com/appXXXXXXXXXXXXXX/...` → `appXXXXXXXXXXXXXX`
   - Get Table IDs from API docs: `tblXXXXXXXXXXXXXX`

5. Create your first user:
   ```bash
   # Generate a bcrypt hash of your password:
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10, (e,h) => console.log(h))"
   ```
   Add this to your Users table:
   ```
   id: rec_user_1
   email: you@aimhigher.gg
   name: Your Name
   password_hash: [hash from above]
   ```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Groq (get key from https://console.groq.com)
GROQ_API_KEY=gsk_...

# Airtable (from steps above)
AIRTABLE_PAT=pat_...
AIRTABLE_BASE_ID=app...
AIRTABLE_LEADS_TABLE_ID=tbl...
AIRTABLE_USERS_TABLE_ID=tbl...

# JWT Secret (generate: openssl rand -base64 32)
JWT_SECRET=your-secret-key-min-32-chars

# Xpoz (optional - get from https://xpoz.ai)
XPOZ_API_KEY=your-xpoz-key-here
```

### 4. Run Locally

```bash
npm run dev
```

Open http://localhost:3000 → redirects to /login

**Login with:**

- Email: `you@aimhigher.gg`
- Password: (whatever you set in Airtable)

---

## Test Checklist (5 min)

After logging in:

- [ ] **Scout:** Click "Hunt Live Projects" → finds ≥3 projects
- [ ] **Scout:** Click "Save Lead" on a project → appears in Airtable
- [ ] **Outreach:** Send "We need help with marketing" → Rex responds
- [ ] **Onboarding:** Send "How do I start?" → Aria responds with Step 1
- [ ] **Q&A:** Send "What's the minimum pool size?" → Sage answers
- [ ] **Logout:** Click logout → redirected to login
- [ ] **Session check:** Try to access / without login → redirected to /login

---

## Deploy to Vercel (Recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/aimhigher-team.git
git push -u origin main
```

### 2. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow prompts, link your GitHub repo.

### 3. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```
GROQ_API_KEY = gsk_...
AIRTABLE_PAT = pat_...
AIRTABLE_BASE_ID = app...
AIRTABLE_LEADS_TABLE_ID = tbl...
AIRTABLE_USERS_TABLE_ID = tbl...
JWT_SECRET = [your-secret-32-chars]
XPOZ_API_KEY = ...
NEXT_PUBLIC_APP_URL = https://your-vercel-url.vercel.app
```

### 4. Deploy

```bash
vercel --prod
```

### 5. Test Production

Visit your Vercel URL:

- [ ] Login page loads
- [ ] Scout finds projects
- [ ] Leads save to Airtable
- [ ] All 4 agents respond
- [ ] No 401/403/500 errors in Vercel logs

---

## Customizing the Agents

All agent prompts and the AimHigher knowledge base live in one file:

**`lib/agents.ts`**

Update `AIMHIGHER_KB` when product details change. All 4 agents automatically pick up the changes.

Update individual prompts in `AGENT_PROMPTS` to change agent personality, tone, or logic.

---

## Swapping Scout Queries

The Twitter search queries that feed the Scout are in `lib/agents.ts` under `SCOUT_QUERIES`.

Add new queries to hunt for specific pain points:

```typescript
export const SCOUT_QUERIES = {
  pain_points: [
    '"KOL" AND ("dump" OR "zero results")',
    // Add your own signals here
  ],
  ...
}
```

---

## File Structure

```
aimhigher-team/
├── lib/
│   ├── types.ts              # Centralized TypeScript interfaces
│   ├── auth.ts               # JWT + bcrypt helpers
│   ├── groq-client.ts        # Groq API wrapper
│   ├── airtable-client.ts    # Airtable CRUD wrapper
│   └── agents.ts             # Prompts, KB, Scout queries
├── pages/
│   ├── login.tsx             # Login page
│   ├── index.tsx             # Main UI (all 4 agents)
│   ├── _app.tsx
│   └── api/
│       ├── auth/
│       │   ├── login.ts      # Login endpoint
│       │   ├── logout.ts     # Logout endpoint
│       │   └── me.ts         # Current user endpoint
│       ├── chat.ts           # Groq proxy for agents
│       ├── scout.ts          # Scout + Xpoz scoring
│       └── leads.ts          # Lead CRUD
├── .env.example              # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Environment Variables Reference

| Variable                  | Required | Description                                               |
| ------------------------- | -------- | --------------------------------------------------------- |
| `GROQ_API_KEY`            | ✅       | From https://console.groq.com                             |
| `AIRTABLE_PAT`            | ✅       | Personal Access Token from Airtable                       |
| `AIRTABLE_BASE_ID`        | ✅       | Base ID from Airtable URL                                 |
| `AIRTABLE_LEADS_TABLE_ID` | ✅       | Leads table ID                                            |
| `AIRTABLE_USERS_TABLE_ID` | ✅       | Users table ID                                            |
| `JWT_SECRET`              | ✅       | For signing JWT tokens (min 32 chars)                     |
| `XPOZ_API_KEY`            | Optional | For live Twitter search (Scout fallback works without it) |
| `XPOZ_API_BASE`           | Optional | Xpoz API endpoint (default: https://mcp.xpoz.ai/mcp)      |
| `NEXT_PUBLIC_APP_URL`     | Optional | Your deployed URL                                         |

---

## Groq Models Used

- **Scout:** `mixtral-8x7b-32768` (complex JSON scoring)
- **Rex (Outreach):** `llama-2-70b-4096` (conversational)
- **Aria (Onboarding):** `llama-2-70b-4096` (step-by-step)
- **Sage (Q&A):** `llama-2-70b-4096` (simple answers)

Switch models by editing `GROQ_MODELS` in `lib/groq-client.ts`.

---

## Authentication

- **Login:** Email + password (bcrypt verified against Airtable Users table)
- **Session:** JWT token in httpOnly cookie (7-day expiry)
- **Protected Routes:** All /api/\* routes require valid session
- **Logout:** Clears session cookie

---

## Adding Users

For each team member, add a row to your Airtable Users table:

```
email: teammate@aimhigher.gg
name: Teammate Name
password_hash: [bcrypt hash of their password]
```

Generate bcrypt hash:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('password', 10, (e,h) => console.log(h))"
```

---

## Support & Docs

- AimHigher docs: https://aimhigher.gitbook.io/product-docs/
- AimHigher site: https://aimhigher.gg
- Groq docs: https://console.groq.com/docs
- Airtable API: https://airtable.com/api

---

## Next Steps (v1.1 Post-Launch)

- [ ] Snapshot governance vote detection (auto-score 10)
- [ ] Slack notifications for Premium leads
- [ ] Lead status workflow UI (new → contacted → converted)
- [ ] Role-based access (admin/editor/viewer)
- [ ] Custom outreach templates per vertical

---

# **Ready to ship. Deploy with confidence.** 🚀
