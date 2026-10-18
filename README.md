# ThePekFinance

Personal stock app: live prices, news, portfolio P&L, alerts and AI summaries for US, SGX and Paris markets.

## Layout
- `apps/web` - Next.js web app (also serves the API routes)
- `apps/mobile` - Expo app (Phase 6)
- `packages/shared` - types, provider interface, P&L / FX math
- `supabase` - database migrations and edge functions

## Getting started
1. `npm install`
2. Copy `.env.example` to `apps/web/.env.local` and add your keys
3. `npm run dev` - web app at http://localhost:3000
4. `npm test` - unit tests
