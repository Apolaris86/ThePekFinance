# ThePekFinance

Personal stock app: live prices, news, portfolio P&L, price alerts and AI summaries for US, SGX and Paris markets.

**Live:** https://thepekfinance.vercel.app

## Layout
- `apps/web` - Next.js web app; also serves the API (`/api/*`) the mobile app uses
- `apps/mobile` - Expo (React Native) app
- `packages/shared` - types, API client, Supabase data functions, P&L / FX math, formatting
- `supabase/migrations` - database schema (run in the Supabase SQL editor)
- `supabase/functions/check-alerts` - Edge Function run every minute on weekdays by pg_cron
- `supabase/cron` - the pg_cron schedule template

## Services
| Service | Used for | Config |
|---|---|---|
| Yahoo Finance (unofficial) | quotes, charts, search, SGX/Paris, FX | none |
| Finnhub | real-time US prices + news | `FINNHUB_API_KEY` |
| Supabase | auth, database, alerts function | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Anthropic (Claude Haiku 5.5) | AI summaries and digest | `ANTHROPIC_API_KEY` |
| Resend | alert emails | Supabase function secret `RESEND_API_KEY` |
| Vercel | hosts the web app | project `thepekfinance`, root `apps/web` |

## Local development
1. `npm install`
2. Copy `.env.example` to `apps/web/.env.local` and fill in the keys
3. `npm run dev` - web app at http://localhost:3000
4. `npm test` - unit tests

Mobile: create `apps/mobile/.env.local` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
`EXPO_PUBLIC_API_URL` (the live URL, or `http://<your PC's LAN IP>:3000` to test local API changes), then
`cd apps/mobile && npx expo start` and scan the QR code with Expo Go.

## Deploying
- Web: `npx vercel deploy --prod` from the repo root (env vars live in the Vercel project)
- Alerts function: `npm run deploy:alerts`
- Function secrets: `npx supabase secrets set NAME=value --project-ref <ref>`
