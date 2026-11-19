# ThePekFinance: Integration Guide

How ThePekFinance is built, and how to move its features into a larger application.
Written against the code at commit `8f5b9ba` (November 2026).

---

## 1. What it does

| Feature | Where | Notes |
|---|---|---|
| Market overview | web `/`, mobile Markets tab | Index cards (S&P 500, Nasdaq, Dow, STI, CAC 40) with sparklines, movers for US / SGX / Paris, FX rates, market news |
| Search | web header, mobile Search screen | US, SGX (`.SI`) and Euronext Paris (`.PA`) tickers |
| Stock detail | web `/quote/[symbol]`, mobile `quote/[symbol]` | Live price, chart (1D…MAX), key stats, company profile, news, AI summary, follow / add holding / alert |
| Watchlists | web `/watchlist`, mobile tab | Several named lists, reorder, live prices |
| Portfolios | web `/portfolio`, mobile tab | Two portfolios per user (Investment, Trading); lots grouped by symbol; P&L; totals in USD or AUD; gain over 1D…2Y; sortable holdings; edit shares / avg cost; value-over-time chart with per-holding picker and period growth %; allocation bars by holding, investment type, investment theme, sector, asset type, country, market cap; AI daily digest |
| Price alerts | web `/alerts`, mobile tab | Above / below price, or ±% move in a day; one-shot; email (Resend) + push (Expo) |
| News | web `/news`, mobile tab | Top stories and "My news" (merged from holdings and watchlists) |
| Compare | web `/compare` | Up to 5 tickers as % change, side-by-side stats |
| AI | stock summary, portfolio digest | Claude Haiku 5.5, structured output, no investment advice |
| Live prices | web + mobile | Finnhub WebSocket for US stocks (signed-in users); SGX and Paris polled (exchange-delayed) |

---

## 2. Architecture

```
                         ┌───────────────────────────────┐
  Browser (Next.js UI) ──┤  apps/web  (Next.js 16)        │── Yahoo Finance (unofficial, no key)
  Phone (Expo app) ──────┤  /api/*  = market data + AI   │── Finnhub REST (US quotes, news)
        │                │  server/  = providers, cache  │── Anthropic API (Claude Haiku 5.5)
        │                └───────────────────────────────┘
        │  supabase-js (user data, RLS)        ▲ Bearer <Supabase access token> for /api/ai/*, /api/live-token
        ▼                                      │
  ┌──────────────────────────────┐             │
  │ Supabase                     │             │
  │  Auth (email + password)     │             │
  │  Postgres + RLS              │             │
  │  Edge Function check-alerts ◄── pg_cron (every minute, Mon–Fri UTC)
  │    → Resend email, Expo push │
  └──────────────────────────────┘
  Browser/phone ── WebSocket ──► Finnhub (live US trades; key handed out by /api/live-token)
```

**Two data paths, on purpose:**
- **Market data and AI** go through the Next.js API (`/api/*`), so API keys stay on the server and responses are cached.
- **User data** (watchlists, portfolios, holdings, alerts) is read and written straight from the client with `supabase-js`. Row Level Security (RLS) scopes every row to `auth.uid()`. There is no custom backend for user data.

### Monorepo layout (npm workspaces + Turborepo)

| Path | What it is | Portability |
|---|---|---|
| `packages/shared` | Framework-free TypeScript: types, API client, Supabase data functions, P&L / FX / period math, allocation + classification, alert rules, formatting, market hours | **Copy as-is.** No React, no Next. Depends on `@supabase/supabase-js` (types + client calls) and `zod`. |
| `apps/web/src/server` | Server-only market data layer: Yahoo + Finnhub providers, cached getters, HTTP helpers, auth check, AI calls | Portable to any Node server; uses Next 16 `"use cache"` (see §9) |
| `apps/web/src/app/api` | Route handlers: thin wrappers over `server/` | Next.js App Router specific |
| `apps/web/src/components`, `src/lib` | React UI (Tailwind v4) and hooks (TanStack Query) | Reusable in any React 19 + Tailwind app |
| `apps/mobile` | Expo SDK 58 app (expo-router native tabs) | Separate app; talks to the deployed `/api/*` and Supabase |
| `supabase/migrations` | Schema, RLS, triggers (run in order) | Postgres + Supabase Auth |
| `supabase/functions` | `check-alerts` Edge Function (Deno) + `_shared/alerts.ts` rules | Supabase Edge Functions |
| `supabase/cron` | pg_cron schedule template (uses Vault secrets) | Supabase |

---

## 3. Choosing an integration approach

| Approach | When | Effort |
|---|---|---|
| **A. Merge the code into the host app** | The host is a Next.js (App Router) + React app, ideally on Supabase | Medium. Copy `packages/shared`, `apps/web/src/server`, the API routes and the UI you want; adapt auth (§8). |
| **B. Run it as a separate service** | The host is a different stack, or you want to keep it isolated | Low. Deploy `apps/web` as-is and call its `/api/*` from the host (with `createApiClient`, §5). User features need the same Supabase project or an auth bridge. |
| **C. Embed the UI** | Quickest way to show it inside another app | Lowest. Link to it, or iframe the deployed pages. Sessions don't cross origins, so users sign in inside the frame. |

Recommended path for a bigger Next.js app: **A**, done in stages: shared package → server data layer + API routes → database → UI pages → alerts job → (optional) mobile.

---

## 4. Database (Supabase / Postgres)

Run the migrations in `supabase/migrations` in order:

| Migration | Creates |
|---|---|
| `0001_watchlists_portfolio.sql` | `profiles` (base currency), `watchlists`, `watchlist_items`, `holdings` (one row per purchase lot), RLS, and the `handle_new_user()` trigger on `auth.users` |
| `0002_alerts.sql` | `alerts` (one-shot rules: `above`, `below`, `move`), `alert_events` (trigger history; written only by the service role) |
| `0003_push_tokens.sql` | `push_tokens` (Expo tokens per device); adds `alert_events.pushed` |
| `0004_portfolios.sql` | `portfolios` (Investment, Trading per user); adds `holdings.portfolio_id`; base currency limited to `USD` / `AUD`; replaces `handle_new_user()` |

### Tables at a glance

| Table | Key columns | RLS |
|---|---|---|
| `profiles` | `id = auth.users.id`, `base_currency in ('USD','AUD')` | own row |
| `watchlists` | `user_id`, `name`, `position` | own rows |
| `watchlist_items` | `watchlist_id`, `user_id`, `symbol`, `position`, unique (watchlist, symbol) | own rows, and the watchlist must be yours |
| `portfolios` | `user_id`, `name`, `position`, unique (user, name) | own rows |
| `holdings` | `user_id`, `portfolio_id`, `symbol`, `shares`, `buy_price`, `buy_date`, `currency` | own rows, and the portfolio must be yours |
| `alerts` | `user_id`, `symbol`, `kind`, `threshold`, `active`, `triggered_at` | own rows |
| `alert_events` | `alert_id`, `user_id`, `price`, `change_percent`, `currency`, `emailed`, `pushed`, `triggered_at` | users can only **select**; the service role writes |
| `push_tokens` | `user_id`, `token` (unique), `platform` | own rows |

Every user-owned table defaults `user_id` to `auth.uid()`, so client inserts never send it.

### Things to adapt in a host database
- **`handle_new_user()` trigger.** It inserts a profile, a default watchlist and two portfolios for each new `auth.users` row. If the host already has a sign-up trigger or its own `profiles` table, merge the logic or rename (e.g. `finance_profiles`) to avoid clashes.
- **Table names are generic** (`profiles`, `alerts`, `holdings`). Prefix them (e.g. `fin_`) or use a dedicated Postgres schema if the host already uses these names. Update `packages/shared/src/db.ts` to match.
- **Symbol check constraint:** `^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$` (Yahoo-style tickers).
- **Sign-ups are disabled** in the current Supabase project (single user). A multi-user host can turn them on; nothing in the schema assumes one user.

---

## 5. HTTP API (`apps/web/src/app/api`)

All `GET`, JSON responses. Errors are `{ "error": string }` with status 400 (bad input), 401 (sign-in required), 404 (unknown symbol), 429 / 502 / 503 (provider or AI problems).
Symbols are Yahoo-style: `AAPL`, `BRK-B`, `D05.SI`, `MC.PA`, `^GSPC`.

| Endpoint | Auth | Returns | Server cache |
|---|---|---|---|
| `/api/quote/{symbol}` | – | `Quote` | 15 s |
| `/api/quotes?symbols=A,B,…` (≤50) | – | `Quote[]` | 15 s |
| `/api/history/{symbol}?range=1D\|5D\|1M\|6M\|YTD\|1Y\|2Y\|5Y\|MAX` | – | `Candle[]` | 60 s intraday, hours otherwise |
| `/api/histories?symbols=A,B,…&range=1Y` (≤60) | – | `Record<symbol, Candle[]>` (failed symbols → `[]`) | as above |
| `/api/profile/{symbol}` | – | `CompanyProfile \| null` (sector, industry, country, description…) | days |
| `/api/news?symbol=X` (optional) | – | `NewsItem[]` | 5 min |
| `/api/search?q=…` | – | `SearchResult[]` (US, SGX, Paris only) | hours |
| `/api/movers?market=US\|SGX\|EPA` | – | `{ gainers, losers, active }: Quote[]` | 60 s |
| `/api/fx` | – | `{ USD: 1, SGD, EUR, AUD }`: value of 1 unit in USD | 5 min |
| `/api/live-token` | **Bearer** | `{ token }`: the Finnhub key for the browser WebSocket | none |
| `/api/ai/summary/{symbol}` | **Bearer** | `StockSummary` (`headline`, `points[]`, `sentiment`) | per symbol per day |
| `/api/ai/digest?portfolio={id}` | **Bearer** | `PortfolioDigest` (`headline`, `points[]`, `watch[]`) | per holdings set per day |

**Auth:** `Authorization: Bearer <Supabase access token>`, verified by `requireUser()` in `apps/web/src/server/auth.ts`. That function also returns a Supabase client *acting as the user*, so server reads still go through RLS.

**Typed client:** `createApiClient(baseUrl, getToken?)` in `packages/shared/src/api.ts` wraps every endpoint (`quote`, `quotes`, `history`, `histories`, `profile`, `news`, `search`, `fx`, `movers`, `stockSummary`, `portfolioDigest`). Pass `""` for the same origin, or the deployed URL from another app.

**CORS:** off in production. In development the API allows `http://localhost:8081` (the Expo web preview), configured in `apps/web/next.config.ts`. If the host calls this API from another browser origin (approach B), add that origin there.

---

## 6. Shared package reference (`packages/shared/src`)

| Module | Exports (main) | Purpose |
|---|---|---|
| `types.ts` | `Quote`, `Candle`, `NewsItem`, `CompanyProfile`, `Holding`, `Currency` (`USD/SGD/EUR/AUD`), `BaseCurrency` (`USD/AUD`), `Exchange` (`US/SGX/EPA`), `FxRates`, `Movers`, `StockSummary`, `PortfolioDigest` | Domain types |
| `api.ts` | `createApiClient`, `ApiError` | Typed HTTP client for §5 |
| `db.ts` | `listWatchlists`, `createWatchlist`, `renameWatchlist`, `deleteWatchlist`, `addToWatchlist`, `removeFromWatchlist`, `reorderWatchlist`, `listPortfolios`, `listHoldings`, `addHolding`, `updateHolding`, `deleteHolding`, `getBaseCurrency`, `setBaseCurrency`, `listAlerts`, `createAlert`, `setAlertActive`, `deleteAlert`, `listAlertEvents` | Supabase data access; each takes a `SupabaseClient` (RLS-scoped) |
| `portfolio.ts` | `convert`, `valueHolding`, `summarize`, `groupLots`, `portfolioSeries`, `seriesReturn`, `GAIN_PERIODS`, `periodBaseline`, `lotsPeriodChange`, `sumPeriodChanges` | P&L, multi-currency totals, value history, growth excluding money added |
| `allocation.ts` | `ALLOCATION_VIEWS`, `allocate`, `assetTypeOf`, `marketCapBucket` | Groups holdings into slices (with member holdings for tooltips) |
| `classification.ts` | `CLASSIFICATIONS`, `classify` | Investment type and theme per symbol (from the owner's research sheets); falls back to quote type + sector, with an `auto` flag |
| `alerts.ts` | `isTriggered`, `describeAlert` (re-exported from `supabase/functions/_shared/alerts.ts`) | Alert rules shared by the UI and the Edge Function |
| `hours.ts` | `sessionStatus`, `pollInterval` | Exchange session hours (holidays not modelled) for polling cadence |
| `symbols.ts` | `exchangeOf`, `currencyOf`, `timezoneOf`, `normalizeSymbol`, `isValidSymbol` | Ticker helpers |
| `format.ts` | `formatPrice`, `formatSignedPrice`, `formatPercent`, `formatCompact`, `formatNumber`, `timeAgo` | Intl formatting used by web and mobile |

Unit tests (`*.test.ts`, Vitest) cover the money math, allocation, alert rules and market hours: `npm test -w @pek/shared`.

**Import note:** `alerts.ts` re-exports a `.ts` path outside the package, so consumers need `"allowImportingTsExtensions": true` (with `noEmit`) in their `tsconfig.json`, and the bundler must be able to resolve files outside the package (Next/Turbopack and Metro do). Alternatively, copy `supabase/functions/_shared/alerts.ts` into the package.

---

## 7. External services and configuration

| Variable | Where | Secret | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | no | Supabase project URL (no `/rest/v1` suffix) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | no (publishable) | Supabase publishable / anon key |
| `FINNHUB_API_KEY` | web server | **yes** | Real-time US quotes + news; also handed to signed-in browsers for the WebSocket |
| `ANTHROPIC_API_KEY` | web server | **yes** | AI summaries and digest |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | no | As above, for the app |
| `EXPO_PUBLIC_API_URL` | mobile | no | Base URL of the deployed web app's API |
| `CRON_SECRET` | Edge Function secret + Vault `pek_cron_secret` | **yes** | Authenticates pg_cron → check-alerts |
| `RESEND_API_KEY` | Edge Function secret | **yes** | Alert emails |
| `ALERT_FROM` | Edge Function secret (optional) | no | Sender, default `ThePekFinance <onboarding@resend.dev>` |
| `APP_URL` | Edge Function secret | no | Links in alert emails |
| `EXPO_ACCESS_TOKEN` | Edge Function secret (optional) | **yes** | Only if Expo push security is enabled |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (injected automatically) | **yes** | Service-role access for the job |

Providers:
- **Yahoo Finance:** through the unofficial `yahoo-finance2` package. Quotes, charts, search, SGX / Paris, indices, FX, profiles. There's no SLA; everything goes through `MarketDataProvider` (`packages/shared/src/provider.ts`), so it can be swapped for a paid provider in one place (`apps/web/src/server/providers`).
- **Finnhub (free tier):** 60 REST calls a minute, one WebSocket per key, US only.
- **Anthropic:** model `claude-haiku-5-5`, `effort: "low"`, structured output through `zodOutputFormat` (`apps/web/src/server/ai.ts`).
- **Resend:** email. Until a domain is verified, it only delivers to the account owner's address.
- **Expo Push:** `https://exp.host/--/api/v2/push/send`.

---

## 8. Authentication model and how to swap it

Currently: **Supabase Auth, email + password**, sessions kept client-side.

| Layer | File | What it does |
|---|---|---|
| Web client | `apps/web/src/lib/supabase.ts`, `lib/auth.tsx` | Browser client (session in localStorage), `AuthProvider` / `useAuth` / `RequireAuth` |
| Mobile client | `apps/mobile/src/lib/supabase.ts` | Session in `expo-sqlite` localStorage, refreshed only while the app is in the foreground |
| API token | `lib/queries.ts`: `createApiClient("", () => session.access_token)` | Sends the Bearer token to protected routes |
| Server check | `apps/web/src/server/auth.ts`: `requireUser(req)` | Verifies the token; returns the user and an RLS-scoped client |

**If the host uses Supabase too:** point both apps at the same project and reuse its sessions; nothing to change.

**If the host uses another auth (NextAuth, Clerk, Auth0…):**
1. Replace `requireUser()` with the host's session check.
2. User data currently relies on RLS with `auth.uid()`. Either:
   - mint Supabase-compatible JWTs for host users (Supabase supports third-party auth providers), keeping RLS as-is; or
   - move user-data access to server routes that use the service role and filter by the host's user id. Then `db.ts` functions are called server-side with that id, and the RLS policies become a backstop.
3. Replace the `getToken` passed to `createApiClient` with the host's token getter.
4. `handle_new_user()` (§4) won't fire for users who don't exist in `auth.users`. Create the default portfolios and watchlist from the host's sign-up flow instead.

---

## 9. Next.js 16 specifics (read before porting the server code)

The web app runs **Next.js 16.4 with `cacheComponents` and `partialPrefetching` on**. If the host runs an older Next version, adapt the following:

| Here | On Next 14/15 without Cache Components |
|---|---|
| `"use cache"` + `cacheLife({...})` in `apps/web/src/server/data.ts` | `unstable_cache(fn, keyParts, { revalidate })` or `fetch(..., { next: { revalidate } })` |
| `await connection()` in routes that must never be prerendered (`/api/live-token`, `/api/fx`) | `export const dynamic = "force-dynamic"` |
| Errors thrown inside a `"use cache"` function lose their class, so getters return `null` and routes turn that into 404 | Can keep the same pattern |
| Client hooks reading request data (`usePathname`, `useSearchParams`) are wrapped in `<Suspense>` | Harmless to keep |
| `error.tsx` receives `retry` (not `reset`) | Use `reset` |
| `RouteContext<"/api/quote/[symbol]">` / `PageProps<…>` global types (from `next typegen`) | Type `params` manually |

Other configuration in `apps/web/next.config.ts`:
- `transpilePackages: ["@pek/shared"]`
- dev-only `allowedDevOrigins: ["192.168.*.*"]`, so phones on the LAN can open the dev site
- the dev-only CORS headers from §5

---

## 10. UI and styling

- **Stack:** React 19, Tailwind CSS v4, TanStack Query v5, `lightweight-charts` v5 for price charts, plain SVG for sparklines.
- **Theme tokens** live in `apps/web/src/app/globals.css` as CSS variables, exposed to Tailwind through `@theme inline`:
  - `--background`, `--foreground`, `--muted`, `--border`, `--surface`, `--accent`
  - `--up` / `--up-bg` and `--down` / `--down-bg` for gains and losses

  There are light and dark values (dark follows `prefers-color-scheme` or `data-theme`). To blend into a host design system, map these variables to the host's tokens; the components only use these utility names (`bg-surface`, `text-muted`, `text-up`…).
- **Portable components** (no app-specific state beyond the hooks they import):
  - `stock/PriceChart`, `compare/CompareChart`, `Sparkline`, `NewsList`, `SearchBox` (with an `onSelect` prop)
  - `AiCard`, `portfolio/AllocationBars`, `HoldingForm`, `alerts/AlertForm`
- **Page containers:** `PortfolioView`, `WatchlistView`, `AlertsView`, `MarketOverview`, `StockView`, `CompareView`, `NewsView`. These compose the hooks in `lib/` and are the units to mount as host routes.
- **Hooks:**
  - `lib/queries.ts`: market data, plus `marketPoll`, which reads the clock only in the browser
  - `lib/db-queries.ts`: user data; all query keys sit under `["db", userId]`, so sign-out clears them in one call
  - `lib/period.ts`: batched histories and period changes
  - `lib/live.ts`: the Finnhub WebSocket. It runs one socket per tab with ref-counted subscriptions, and writes trades into the `["quote", symbol]` cache once a second.
- **Per-browser preferences** in localStorage, all guarded: selected portfolio, holdings sort, allocation view, recent searches, selected watchlist.

---

## 11. Background job: price alerts

1. **pg_cron** (`supabase/cron/schedule-alerts.sql`) calls `POST {SUPABASE_URL}/functions/v1/check-alerts` every minute, Monday to Friday (UTC). The project URL and the `x-cron-secret` header value are read from **Vault** (`pek_project_url`, `pek_cron_secret`), never stored in the job text.
2. **`check-alerts`** (Deno; `npm run deploy:alerts`, deployed with `--no-verify-jwt`, so the secret header is the only auth):
   1. loads active alerts with the service role;
   2. batch-quotes them through `yahoo-finance2`;
   3. evaluates each rule with `isTriggered`;
   4. **claims** fired alerts atomically (`update … set active=false where id in … and active=true returning id`), so overlapping runs never double-send;
   5. records `alert_events`, then sends one email per user (Resend) and Expo pushes, deleting tokens Expo reports as `DeviceNotRegistered`.
3. **Rules:** `above`/`below` fire whenever the price is at or past the threshold. `move` fires only during the regular session, so it never fires on the previous day's change. Alerts are one-shot; the user re-arms them.

To host the job elsewhere (e.g. a host's queue or cron), reuse `supabase/functions/_shared/alerts.ts` and port the ~200 lines of `check-alerts/index.ts`; it only needs a service-role DB client, a quote source and the two notification calls.

---

## 12. Mobile app (`apps/mobile`)

- **Platform:** Expo SDK 58, React Native 0.88, expo-router native tabs (Markets, Watchlist, Portfolio, News, Alerts), plus `quote/[symbol]`, `search` and `login` screens.
- **Shared code:** reuses `@pek/shared` for the API client, data functions, math, alert rules and formatting.
- **Data:** calls the deployed web API (`EXPO_PUBLIC_API_URL`) and Supabase directly. It polls instead of streaming over the WebSocket.
- **Push:** `src/lib/push.ts` registers the Expo push token after sign-in and removes it on sign-out. There are `.web.ts` stubs for the web preview.
- **Builds and updates:** EAS (`eas.json`); over-the-air updates with `npm run update:app` (preview channel, Android).
- **To fold into a host's existing Expo app:** copy `src/lib/*`, `src/components/*` and the screens, add `@pek/shared` as a workspace dependency, and merge `app.json` plugins (`expo-router`, `expo-sqlite`, `expo-notifications`).

---

## 13. Integration checklist (approach A, into a Next.js host)

1. **Shared code:** copy `packages/shared` into the host monorepo (or publish it privately); add it to `transpilePackages`; enable `allowImportingTsExtensions`, or inline `alerts.ts`.
2. **Dependencies:** add `yahoo-finance2`, `@anthropic-ai/sdk`, `zod`, `@supabase/supabase-js`, `@tanstack/react-query` and `lightweight-charts` to the host.
3. **Server layer:** copy `apps/web/src/server/**`. Adapt caching (§9) if the host isn't on Next 16 with Cache Components.
4. **API routes:** copy `apps/web/src/app/api/**`. Optionally mount them under a prefix such as `/api/finance/*`; then pass that prefix as the `baseUrl` to `createApiClient`, adjusting its paths, or add rewrites.
5. **Environment:** set the variables in §7 in the host's environment.
6. **Database:** run migrations 0001–0004, after resolving name clashes and the sign-up trigger (§4).
7. **Auth:** wire it up (§8). Same Supabase project = no changes.
8. **UI:**
   - Wrap the finance pages in a `QueryClientProvider`, plus `AuthProvider` or the host's equivalent.
   - Mount the page containers (§10) on host routes.
   - Map the theme tokens.
9. **Alerts:**
   - Deploy `check-alerts` and set its secrets.
   - Create the Vault secrets and run the cron SQL.
   - Verify a sender domain in Resend for multiple recipients.
10. **Verify:**
    - `npm test` for the shared math.
    - Smoke-test each `/api/*` route with one US, one `.SI` and one `.PA` ticker.
    - Sign in, add a holding, check P&L and allocation, and create an alert that's already met; it should fire within a minute on a weekday.

---

## 14. Known limitations and gotchas

- **Markets:** US, SGX and Euronext Paris only (`exchangeOf` maps any other suffix, e.g. `.HK` or `.AX`, to "US"). Adding a market means updating `symbols.ts` (exchange, currency, timezone), `hours.ts` (session times), `Currency`, the search venue map in `providers/yahoo.ts`, and the FX pairs.
- **Delayed data:** SGX and Paris prices are exchange-delayed (~15–20 min); only US is real-time, and only with a Finnhub key.
- **Exposed Finnhub key:** signed-in browsers receive the Finnhub key, because Finnhub has no short-lived tokens. Fine for a trusted user base; for a public product, relay the WebSocket through a server you control.
- **No rate limiting on public `/api/*`:** server caching softens bursts, but a public host should add rate limiting.
- **Classification is hard-coded:** investment type and theme live in `packages/shared/src/classification.ts`. Per-user, editable classification would need a table (a follow-up was scoped for this).
- **Historical FX:** value-over-time charts convert past values at today's FX rates.
- **Market hours:** the polling cadence ignores public holidays; display state uses Yahoo's `marketState`, which knows them.
- **Single-user assumptions are minimal:** sign-ups are disabled in the Supabase project, and Resend's test sender only delivers to the owner. The schema and code are multi-user.
- **Sessions:** web sessions are per origin (localhost, LAN IP and production are separate sign-ins).

---

## 15. Useful commands

```bash
npm install                      # install every workspace
npm run dev                      # web app at http://localhost:3000
npm test                         # shared unit tests
npm run build -w @pek/web        # production build of the web app
npx vercel deploy --prod         # deploy web (project root apps/web; env vars live in Vercel)
npm run deploy:alerts            # deploy the check-alerts Edge Function
npm run update:app               # over-the-air update for the mobile app (preview channel)
cd apps/mobile && npx expo start # run the mobile app in Expo Go
```
