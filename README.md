# NU Connect

Telegram Mini App — safe, verified hookup community for NU students only.  
$0/month infrastructure. No App Store. No install friction.

---

## Setup (follow in order)

### Step 1 — Telegram Bot

1. Open Telegram → search `@BotFather`
2. Send `/newbot` → choose a name (e.g. "NU Connect") and username (e.g. `nuconnect_bot`)
3. Copy the **token** → paste into `.env` as `BOT_TOKEN`
4. Send `/newapp` to BotFather → follow prompts → set a placeholder URL for now (you'll update it after deploy)

---

### Step 2 — Supabase Project

1. Go to [supabase.com](https://supabase.com) → New project (free tier)
2. Wait ~2 minutes for setup
3. Go to **Settings → API**:
   - Copy **Project URL** → `SUPABASE_URL` in `.env`
   - Copy **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` in `.env`
4. Go to **Storage → New bucket**:
   - Name: `photos`
   - Public: **OFF** (private bucket)
5. Go to **SQL Editor → New Query** → paste contents of `supabase/migrations/001_init.sql` → click **Run**
   - You should see "Success. No rows returned."

---

### Step 3 — Resend (email OTP)

1. Go to [resend.com](https://resend.com) → sign up (free)
2. **API Keys → Create API Key** → copy it → `RESEND_API_KEY` in `.env`
3. Go to **Domains** → add your domain (or use the default `resend.dev` for testing)
4. Update the `from` address in `supabase/functions/onboard-email/index.ts` if needed

---

### Step 4 — Google Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API key** → Create API key → copy it → `GEMINI_API_KEY` in `.env`

---

### Step 5 — Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login and link project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
# Project ref is the part after https:// in your SUPABASE_URL (e.g. abcxyzabcxyz)
```

Set environment secrets:
```bash
supabase secrets set BOT_TOKEN=your_token
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set RESEND_API_KEY=your_key
```

Deploy all functions:
```bash
cd /Users/nurdauletzhumaliyev/nu-connect
supabase functions deploy auth-verify
supabase functions deploy onboard-email
supabase functions deploy onboard-otp
supabase functions deploy onboard-selfie
supabase functions deploy onboard-profile
supabase functions deploy discover
supabase functions deploy swipe
supabase functions deploy matches
supabase functions deploy health
```

Test health endpoint:
```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/health
# Should return: {"ok":true,"ts":"..."}
```

---

### Step 6 — Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub  
   (push this folder to GitHub first, or use `vercel` CLI)

2. Set these in Vercel **Environment Variables**:
   ```
   VITE_SUPABASE_FUNCTIONS_URL = https://YOUR_PROJECT_REF.supabase.co/functions/v1
   ```

3. Set **Root Directory** to `frontend`

4. Deploy → copy the Vercel URL (e.g. `https://nu-connect.vercel.app`)

---

### Step 7 — Wire Mini App URL

1. Back in Telegram → `@BotFather` → `/myapps` → select your app → Edit → set URL to your Vercel URL
2. Also set the Menu Button URL: `/mybots` → select bot → Bot Settings → Menu Button → URL → paste Vercel URL

---

### Step 8 — Uptime Ping (prevents Supabase free tier sleep)

1. Go to [cron-job.org](https://cron-job.org) → sign up (free)
2. New cronjob → URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/health`
3. Schedule: every 5 days
4. Save

---

## Local Development

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
# Telegram initData won't work locally — app shows dev fallback
```

To test Edge Functions locally:
```bash
supabase start        # starts local Supabase
supabase functions serve --env-file ../.env
```

---

## Project Structure

```
nu-connect/
├── frontend/                    # React + Vite + Tailwind (Telegram Mini App)
│   └── src/
│       ├── App.tsx              # Router + auth init
│       ├── api.ts               # All API calls
│       └── screens/
│           ├── OnboardEmail.tsx # Step 1: NU email OTP
│           ├── OnboardSelfie.tsx# Step 2: live selfie
│           ├── OnboardProfile.tsx# Step 3: profile setup
│           ├── Discover.tsx     # Main swipe screen
│           └── Matches.tsx      # Matched users
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql        # Full DB schema + RLS + process_swipe function
│   └── functions/              # Edge Functions (Deno/TypeScript)
│       ├── auth-verify/        # Validate Telegram initData (HMAC-SHA256)
│       ├── onboard-email/      # Send OTP via Resend
│       ├── onboard-otp/        # Verify OTP code
│       ├── onboard-selfie/     # Gemini liveness check
│       ├── onboard-profile/    # Save profile + create user
│       ├── discover/           # Paginated profile cards
│       ├── swipe/              # Atomic swipe + match via DB function
│       ├── matches/            # List matches with signed photo URLs
│       └── health/             # Uptime ping endpoint
├── .env.example                # Copy to .env and fill in
└── README.md
```

---

## Security Notes

- All tables have RLS enabled — direct client access blocked entirely
- Edge Functions use `service_role` key (server-side only, never exposed to browser)
- `nu_email` stored as SHA-256 hash — plaintext never persisted
- Selfie is processed by Gemini and immediately discarded — not stored
- Session tokens are UUIDs with 30-day expiry
- Match creation is atomic via a PostgreSQL stored function — no race conditions
- Photos served via signed URLs with 1-hour expiry

---

*$0/month · Built for NU students · Delete account anytime*
