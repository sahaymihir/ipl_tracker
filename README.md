# IPL LEDGER

A high-stakes IPL betting ledger dashboard with dark theme, real-time stats, charts, Supabase backend, and Vercel runtime config for browser-safe env injection.

## Setup

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com) and create a new project
- Copy your **Project URL** and **anon public key** from Settings → API

### 2. Run Database Migration
Open the **SQL Editor** in your Supabase dashboard and run:

```sql
create table bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  lagaya numeric not null,
  banaya numeric,
  net_profit numeric generated always as (coalesce(banaya, 0) - lagaya) stored,
  result text generated always as (
    case
      when banaya is null then 'pending'
      when (coalesce(banaya, 0) - lagaya) > 0 then 'win'
      when (coalesce(banaya, 0) - lagaya) = 0 then 'loss'
      else 'loss'
    end
  ) stored,
  match_label text,
  created_at timestamptz default now()
);

alter table bets enable row level security;

create policy "Users see own bets" on bets for all using (auth.uid() = user_id);
```

### 3. Create Your User Account
- Default path: open the app and use the new **Create account** option on the auth screen
- Alternate path: create a user manually in **Authentication** → **Users** in Supabase
- If Supabase email confirmation is enabled, verify the account from email before signing in

### 4. Configure Environment Variables
1. Copy `.env.example` to `.env.local` or `.env` for local development
2. Set these values:

```env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-public-anon-key
```

Use the Supabase **anon** key only. Do not put your service role key in browser config.

### 5. Run Locally
1. Install the Vercel CLI if needed: `npm i -g vercel`
2. Start the app with `vercel dev`

This project reads `process.env` from the Vercel runtime through `/api/config`, so opening the HTML files directly will not load env vars.

### 6. Deploy to Vercel
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Project Settings → Environment Variables
4. Deploy

### 7. Use It
1. Visit your Vercel URL → redirects to login
2. Enter your Supabase credentials → authenticate
3. Dashboard auto-seeds your historical IPL data on first load
4. Use the `+` action to log new bets

## Tech Stack
- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JS
- **Backend**: Supabase (Auth + PostgreSQL)
- **Runtime Config**: Vercel Function at `/api/config`
- **Charts**: Chart.js (CDN)
- **Fonts**: Bebas Neue, Sora, JetBrains Mono
- **Icons**: Material Symbols Outlined
- **Deploy**: Vercel (static pages + function)

## Project Structure
```
├── .env.example        ← Example env vars for local/Vercel setup
├── api/config.js       ← Exposes browser-safe runtime config from Vercel env
├── index.html          ← Login screen
├── dashboard.html      ← Main dashboard (fully wired)
├── vercel.json         ← Vercel routing config
└── README.md           ← This file
```
