# 🚀 Quick Start — AimHigher AI Team (30 minutes)

**This guide takes you from zero to running locally in ~30 minutes.**

---

## Step 1: Copy Files (5 min)

```bash
cd /mnt/project

# Copy documentation and config
cp /home/claude/package.json .
cp /home/claude/.env.example .
cp /home/claude/.gitignore .
cp /home/claude/README.md .
cp /home/claude/tsconfig.json .
cp /home/claude/next.config.js .

# Create directories
mkdir -p lib pages/api/auth

# Copy library modules
cp /home/claude/lib_types.ts lib/types.ts
cp /home/claude/lib_auth.ts lib/auth.ts
cp /home/claude/lib_groq-client.ts lib/groq-client.ts
cp /home/claude/lib_airtable-client.ts lib/airtable-client.ts
cp /home/claude/agents.ts lib/agents.ts

# Copy pages
cp /home/claude/pages_login.tsx pages/login.tsx
cp /home/claude/pages_index.tsx pages/index.tsx
cp /home/claude/pages_app.tsx pages/_app.tsx

# Copy API routes
cp /home/claude/api_auth_login.ts pages/api/auth/login.ts
cp /home/claude/api_auth_logout.ts pages/api/auth/logout.ts
cp /home/claude/api_auth_me.ts pages/api/auth/me.ts
cp /home/claude/api_chat.ts pages/api/chat.ts
cp /home/claude/api_scout.ts pages/api/scout.ts
cp /home/claude/api_leads.ts pages/api/leads.ts

echo "✅ All files copied"
```

---

## Step 2: Install Dependencies (5 min)

```bash
npm install
```

**What gets installed:**
- Next.js 14.2.3
- Groq SDK (for LLM calls)
- Airtable SDK (for database)
- bcryptjs (for password hashing)
- jsonwebtoken (for JWT)
- cookie (for session parsing)

---

## Step 3: Setup Airtable (10 min)

### 3.1 Create Airtable Base

1. Go to https://airtable.com
2. Create new base → name it **"AimHigher Leads"**

### 3.2 Create "Leads" Table

Create a table with these **18 columns**:

| Field Name | Type |
|-----------|------|
| id | Text |
| project_name | Text |
| token_ticker | Text |
| chain | Single select (options: Base, Arbitrum, Solana, BNB, Ethereum, Polygon) |
| contract_address | Text |
| estimated_mcap | Text |
| why_good_fit | Long text |
| pain_point | Text |
| estimated_treasury_size | Text |
| contact_handle | Text |
| source_signal | Long text |
| snapshot_vote | URL |
| fit_score | Number |
| score_breakdown_json | Long text |
| verdict | Single select (options: PREMIUM, LEAD) |
| hook | Long text |
| status | Single select (options: new, contacted, qualified, converted, disqualified) |
| created_by | Text |
| notes | Long text |

### 3.3 Create "Users" Table

Create a table with these **4 columns**:

| Field Name | Type |
|-----------|------|
| id | Text |
| email | Email |
| name | Text |
| password_hash | Long text |

### 3.4 Create Your First User

Generate a bcrypt password hash:

```bash
# macOS/Linux:
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10, (e,h) => console.log(h))"

# Save output, then add to Users table:
id: rec_user_1
email: you@aimhigher.gg
name: Your Name
password_hash: [paste hash from above]
```

### 3.5 Get Airtable Credentials

1. **Get PAT:**
   - Go to https://airtable.com/account/personal/developers
   - Click "Create token"
   - Scopes needed: `data.records:read/write`, `schema.bases:read`
   - Copy the token (starts with `pat_`)

2. **Get Base ID:**
   - Open your base
   - Look at URL: `airtable.com/appXXXXXXXXXXXXXX/...`
   - Copy `appXXXXXXXXXXXXXX`

3. **Get Table IDs:**
   - In Airtable, go to API documentation
   - Find Leads table ID (starts with `tbl`)
   - Find Users table ID (starts with `tbl`)
   - Copy both

---

## Step 4: Create Environment File (2 min)

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# From Groq console
GROQ_API_KEY=gsk_YOUR_KEY_HERE

# From Airtable
AIRTABLE_PAT=pat_YOUR_KEY_HERE
AIRTABLE_BASE_ID=appYOUR_BASE_ID
AIRTABLE_LEADS_TABLE_ID=tblYOUR_LEADS_ID
AIRTABLE_USERS_TABLE_ID=tblYOUR_USERS_ID

# Generate JWT secret
JWT_SECRET=YOUR_32_CHAR_SECRET_HERE

# Xpoz (optional)
XPOZ_API_KEY=

# Other
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Generating JWT_SECRET:**

```bash
# macOS/Linux:
openssl rand -base64 32
```

---

## Step 5: Run Locally (3 min)

```bash
npm run dev
```

**Output:**
```
✓ Ready in 2.5s

> Local:        http://localhost:3000
> Environments: .env.local
```

Open http://localhost:3000 → should redirect to `/login`

---

## Step 6: Login & Test (5 min)

**Login with:**
- Email: `you@aimhigher.gg` (from your Airtable Users table)
- Password: (the password you set earlier)

**After login, test each agent:**

1. **Scout:** Click "Hunt Live Projects" → should find projects
2. **Save Lead:** Click "Save Lead" → check Airtable (new row should appear)
3. **Outreach (Rex):** Send a message → should get a response
4. **Onboarding (Aria):** Send "Where do I start?" → should get Step 1
5. **Q&A (Sage):** Send "How much is minimum?" → should answer
6. **Logout:** Click logout → back to login page

✅ **If all tests pass, you're ready to deploy!**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "GROQ_API_KEY not set" | Copy it from console.groq.com to .env.local |
| "Login fails" | Check email + password in Airtable Users table (case-sensitive) |
| "Scout finds nothing" | This is OK! It falls back to knowledge base. Verify GROQ_API_KEY is valid. |
| "Leads not saving" | Check AIRTABLE_LEADS_TABLE_ID and verify Leads table has all 18 columns |
| "Module not found" | Run `npm install` again |
| "Port 3000 in use" | `npm run dev -- -p 3001` (use different port) |

---

## Next Steps

1. ✅ Local test passes → Ready to deploy!
2. → Push to GitHub
3. → Deploy to Vercel
4. → Add team members to Airtable Users table
5. → Monitor for issues

---

## Full Documentation

- **Setup deep-dive:** README.md
- **Architecture:** DESIGN_AIMHIGHER_COMPLETION.md
- **Deployment:** DEPLOYMENT_CHECKLIST.md
- **Troubleshooting:** HANDOFF.md

---

**You're done! Ready to ship.** 🚀
