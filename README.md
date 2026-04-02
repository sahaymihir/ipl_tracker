# SattaSheet

SattaSheet is a Vercel + Supabase betting ledger with a fully redesigned dark UI, live auth flows, a real operational dashboard, and a dedicated analytics route.

## Stack
- Frontend: HTML, custom CSS, vanilla JavaScript
- Auth + Database: Supabase
- Runtime config: Vercel function at `/api/config`
- Charts: Chart.js
- Deploy: Vercel

## Routes
- `/` -> auth terminal with sign in / create account panels
- `/dashboard` -> live ledger, open positions, account summary, add-entry drawer
- `/analytics` -> equity curve, daily P&L, flow chart, result distribution

## Setup

### 1. Create the Supabase project
Copy your project URL and anon public key from Supabase Settings -> API.

### 2. Create the `bets` table
Run the SQL in `supabase/setup.sql` in the Supabase SQL editor.
The app now treats `public.bets` as a required dependency and will show a setup-specific error until that table exists.

### 3. Configure env vars
Copy `.env.example` to `.env.local` or `.env`, then set:

```env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-public-anon-key
APP_URL=https://your-production-domain.vercel.app
```

`APP_URL` should be the real deployed frontend URL you want email verification to use.
If `APP_URL` is missing or points to a local hostname, the frontend now falls back to your Supabase `Site URL` instead of overriding verification emails with `localhost`.

### 4. Configure Supabase Auth URLs
In Supabase Authentication -> URL Configuration:
- Set `Site URL` to your production app URL
- Add your production URL and any intentional local/preview URLs to `Redirect URLs`

If you want signup emails to be sent, turn on `Confirm Email` in Supabase Auth settings.
The app also blocks dashboard and analytics access until `email_confirmed_at` is present on the Supabase user.

### 5. Run locally
Use Vercel so `/api/config` can inject runtime config:

```bash
npm i -g vercel
vercel dev
```

### 6. Deploy
In Vercel Project Settings -> Environment Variables, add:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_URL`

Then redeploy.

## Functionality
- Signup stores `full_name` in Supabase auth user metadata
- Verification resend uses the production-safe redirect URL
- Dashboard and analytics expect a real `public.bets` table and never auto-seed demo rows
- Add-entry drawer inserts real rows into `bets`
- Analytics charts all read from live Supabase data, not static mocks

## Project Structure
```text
├── .env.example
├── api/config.js
├── assets/app.js
├── assets/auth.js
├── assets/dashboard.js
├── assets/analytics.js
├── assets/sattasheet.css
├── index.html
├── dashboard.html
├── analytics.html
├── supabase/setup.sql
├── vercel.json
└── README.md
```
