# Invesutra

Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

> **This repository is public for viewing only.** Copying, forking, modifying,
> redistributing, deploying, or otherwise using any part of this code — in
> whole or in part, for any purpose — without the Owner's prior written
> permission is **prohibited**. See [`LICENSE`](./LICENSE) and
> [`NOTICE`](./NOTICE) for full terms.

Next.js fintech app: portfolio tracking, a mutual fund screener, and Invesutra AI, an AI portfolio copilot.

## Stack

- Next.js 16 / React 19 / TypeScript
- Supabase (auth + Postgres) for portfolios/funds
- Stripe for billing
- Invesutra AI: Groq / Google Gemini / OpenAI (auto-fallback chain), with
  function-calling tools backed by a Model Context Protocol (MCP) server
  for real mutual fund data

## Environment variables

Create `.env.local` (never commit it):

```bash
# Public URL of the deployed app (used in metadata + auth redirects)
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SEO_INDEXING=false

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_PREMIUM=

# Invesutra AI — configure at least one. The app tries Groq, then Gemini, then
# OpenAI, in that order, and falls back to a deterministic (non-AI)
# analysis if none are configured or all fail.
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=                # optional, defaults to gpt-4o-mini

# Protects /api/health?deep=1, which performs real provider/database checks.
# The ordinary /api/health response is shallow and does not spend AI quota.
HEALTH_CHECK_TOKEN=

# Optional — mutual fund data provider (see below). Not required: the
# default works with zero keys.
MFAPI_BASE_URL=              # override if you self-host an AMFI mirror
MUTUAL_FUND_MCP_SERVER_URL=  # point at a standalone MCP server instead of the built-in in-process one
```

## Mutual fund data / MCP integration

Invesutra AI can search Indian mutual funds and fetch published NAV/returns/category
mid-conversation. Holding changes are reviewed and confirmed in Portfolio, not
automatically executed by chat. Online financial analysis requires in-app consent;
individual purchase details require the current detailed-consent version.

The local assistant answers holding-specific loss, risk, NAV, units and SIP-plan
questions without sending those records to a provider. Missing data remains
unavailable, and category-risk scores are model flags rather than official ratings.
Planned SIP amounts can be edited or cleared from a holding's SIP control; they do
not create transactions or increase invested amounts, units or valuation.

**No API key is required for the fund data itself.** It's implemented as a
real MCP server (`lib/mcp/mutualFundMcpServer.ts`, using
`@modelcontextprotocol/sdk`) exposing `search_mutual_funds` and
`get_fund_details` tools, backed by AMFI's public mutual fund NAV registry
via the free, keyless `api.mfapi.in` service. It runs in-process by
default; set `MUTUAL_FUND_MCP_SERVER_URL` to point it at a separately
hosted MCP server instead, with no other code changes.

**Why not Zerodha's data directly?** Zerodha's official Kite MCP server
(`mcp.kite.trade`) has no mutual-fund screener endpoint — no NAV database,
returns, expense ratio, or risk rating for arbitrary funds — and every
portfolio/holdings tool it does have requires the individual end user's own
live Zerodha OAuth login. It isn't a fit for an anonymous "search any fund"
chat feature. `lib/marketData/providers.ts` documents this and keeps a
`ZerodhaKiteProvider` stub for future personal-account features (e.g.
importing a user's own connected Kite holdings) rather than pretending to
use it for data it doesn't provide.

Fields **not** available from this free data source (expense ratio, AUM)
are returned as `undefined` and surfaced to the AI/UI as "not available" —
never fabricated.

Portfolio forms update Invesutra's own tracker only. They never place a brokerage
order or schedule a SIP payment.

### Persisted chat history

For signed-in users with a real (non-demo) portfolio, Invesutra AI's
conversation is saved to Supabase and reloaded on a full page reload or new
session — not just kept in memory. Demo/guest sessions and empty
(no-portfolio-yet) accounts keep the existing in-memory-only behavior.

**One-time database setup:** in the Supabase SQL Editor, run, in order:
1. `supabase/migrations/001_grants_fix.sql` — required. RLS policies alone don't grant Postgres-level table access; without this, every query fails with "permission denied for table X".
2. `supabase/migrations/002_chat_messages.sql` — enables persisted chat history (below). Safe to skip initially; the app falls back to in-memory-only chat if this hasn't been run yet.
3. `supabase/migrations/003_verified_holding_repairs.sql` - verified purchase corrections and ownership checks.
4. `supabase/migrations/004_monthly_sip_plans.sql` - optional planned monthly contributions.
5. `supabase/migrations/005_saved_report_snapshots.sql` - saved historical report snapshots.
6. `supabase/migrations/20261003044445_harden_trigger_permissions.sql` - fixed trigger search paths and restricted public RPC access, preserving signup/update triggers.
7. `supabase/migrations/20261003052935_sip_purchase_ledger.sql` - atomic, owner-scoped completed allotments with retry and duplicate protection.
8. `supabase/migrations/20261003054602_scheduled_nav_updates.sql` - service-only NAV updates and source-check history.

The first two are also folded into `supabase/schema.sql`. Apply the remaining
migrations after that schema when setting up a fresh project.

### Completed purchases and CSV import

Use the plus control on a verified mutual-fund holding to record a completed
allotment or review a CSV import. The downloaded template uses
`scheme_code,allotment_date,units,buying_nav`; dates must be `YYYY-MM-DD` and every
row must match the selected scheme. Only new purchases should be imported.
PDF/CAS statements and redemptions are not parsed by this CSV workflow. Every
historical buying NAV is verified before the entire batch is committed.
Monthly SIP plans remain separate from actual purchases. Multiple lots retain
their individual dates, units and costs; there is no guessed average buying NAV.

AI privacy choices can optionally be remembered on the device, scoped to account
and portfolio and invalidated by consent-version changes. The privacy control
clears the remembered choice. Financial data is never sent online by default.

### Daily NAV monitoring

`vercel.json` schedules `/api/cron/nav` once daily. Set `CRON_SECRET` as a secret
in the production Vercel environment and keep `SUPABASE_SERVICE_ROLE_KEY`
server-only. The worker authenticates before any database or feed request and
uses the official AMFI catalogue, never an AI provider. It updates NAV value
using the current stored units without changing cost or SIP plans. Missing,
stale or older publications do not replace saved valuations. Portfolio shows
the latest scheduled source-check timestamp after a run.

Report comparison requires two complete saved snapshots of the same portfolio.
Value changes include cash flows and are not labelled as investment returns.

### Verifying the integration

```bash
npm install
npm run build        # type-checks + builds the whole app
npm run test:mcp      # mocked end-to-end smoke test of the MCP server/client/tools (no network needed)
```

`npm run test:mcp` exercises the real MCP protocol round-trip (tool
registration, `tools/call`, JSON parsing, category/risk mapping, return
calculation) with the `api.mfapi.in` HTTP calls mocked, so it runs
anywhere. To confirm live data once deployed, hit:

```
GET /api/funds/search?q=hdfc%20flexi%20cap
GET /api/funds/details?schemeCode=<a code from the search result>
```

## Development

```bash
npm install
npm run dev
```

## License

Proprietary — All Rights Reserved. See [`LICENSE`](./LICENSE) and
[`NOTICE`](./NOTICE).
