# Personal OS

Your expense ledger, a 4-persona AI advisory board, and a 6am daily content-idea
generator — one private PWA, running on free tiers (Vercel + Supabase + OpenRouter).

## 1. Supabase setup

1. Open your Supabase project → **SQL Editor** → New query.
2. Paste the contents of `supabase/schema.sql` and run it. This creates three
   tables: `expenses`, `content_ideas`, `board_sessions`.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → used as both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — it's
     only ever used in `lib/supabaseServer.js`, on the server)

## 2. OpenRouter setup

1. Sign up at [openrouter.ai](https://openrouter.ai) and create an API key
   under **Keys**. No credit card needed for free models.
2. Free models are rate-limited (roughly 20 requests/minute, 200/day per
   model) and can be swapped or removed by providers without notice. This app
   already tries a short list of free models and falls back through them —
   see `lib/openrouter.js` (`FREE_MODELS`) and `lib/personas.js`. Every few
   weeks it's worth checking `openrouter.ai/models?max_price=0` and updating
   that list.

## 3. Local development

```bash
npm install
cp .env.example .env.local   # fill in every value
npm run dev
```

Open `http://localhost:3000`. You'll be asked for the `APP_PASSWORD` you set
in `.env.local` — that's your login gate (see the security note below).

To test the content-idea generator locally without waiting for 6am:

```bash
curl http://localhost:3000/api/cron/generate-ideas \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 4. Deploy to Vercel

1. Push this project to a GitHub repo, then import it in Vercel.
2. In **Project Settings → Environment Variables**, add every variable from
   `.env.example` with your real values. Set `APP_URL` to your final
   `https://your-app.vercel.app` URL once you know it.
3. Deploy. `vercel.json` already defines the cron schedule.

### About the 6am schedule

`vercel.json` runs the cron at `30 0 * * *` — that's **00:30 UTC, which is
6:00 AM IST**. If you're not in India, convert 6am in your timezone to UTC
and edit that line. On Vercel's Hobby plan, cron jobs can run within an hour
of the scheduled time rather than to the exact minute, and only a couple of
cron jobs are allowed per project — you have exactly one here, so you're fine.

### Why a `CRON_SECRET` and not just an open endpoint

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when it
triggers a cron job, using whatever value you set for the `CRON_SECRET`
environment variable. The route checks that header so random visitors can't
trigger (and burn your free-tier quota on) content generation by hitting the
URL directly.

## 5. Install on your iPhone

1. Open your deployed `https://...vercel.app` URL in **Safari** (must be
   Safari, not Chrome, for iOS install to work).
2. Log in with your `APP_PASSWORD`.
3. Tap the Share icon → **Add to Home Screen**.
4. Launch it from the home screen icon from then on — it runs full-screen,
   no browser chrome.

## What this is (and isn't) architecturally

- **Expense ledger** (`/ledger`): manual entry, stored in Supabase, monthly
  total + category breakdown on the home screen.
- **The board** (`/board`): one question fans out in parallel to four AI
  personas (`lib/personas.js`) — Risk Officer, Growth Lead, Operator,
  Long-Term Investor — each with its own system prompt and model.
- **Content ideas** (`/ideas`): a Vercel Cron job hits `/api/cron/generate-ideas`
  every morning, asks a free model for 5 short-form hooks (weighted toward
  Reels/Shorts, with a couple adaptable to X/LinkedIn), and stores them.
- **The password gate** (`proxy.js`) is a basic deterrent, not real
  security — one shared password guards the whole app. The cookie holds a
  signed, expiring token rather than the password itself, but it is still a
  doorlock, not a vault. That's a fine trade-off for personal notes and
  rough expense amounts. Don't put real account numbers, card numbers, or
  passwords into expense notes or board questions.
- **No bank sync.** Real bank-transaction import (Plaid etc.) isn't free, so
  this is manual entry only. If you outgrow that later, that's the piece to
  add.

## Extending it

- Add a category-spend chart on `/ledger` (recharts works well with the App
  Router).
- Add push notifications for new content ideas (requires iOS 16.4+, the
  device must have the PWA installed and have granted notification
  permission at least once from within the installed app).
- Add more board personas, or let `/board` remember past sessions from
  `board_sessions` instead of only logging them.
