# Invesutra

Copyright © 2026 Ayaansh Singhal. All Rights Reserved.

> **This repository is public for viewing only.** Copying, forking, modifying,
> redistributing, deploying, or otherwise using any part of this code — in
> whole or in part, for any purpose — without the Owner's prior written
> permission is **prohibited**. See [`LICENSE`](./LICENSE) and
> [`NOTICE`](./NOTICE) for full terms.

Next.js fintech app: portfolio tracking, a mutual fund screener, and Sutra
AI, an AI portfolio copilot.

## Stack

- Next.js 15 / React 19 / TypeScript
- Supabase (auth + Postgres) for portfolios/funds
- Stripe for billing
- Sutra AI: Groq / Google Gemini / OpenAI (auto-fallback chain), with
  function-calling tools backed by a Model Context Protocol (MCP) server
  for real mutual fund data

## Environment variables

Create `.env.local` (never commit it):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRICE_ID=

# Sutra AI — configure at least one. The app tries Groq, then Gemini, then
# OpenAI, in that order, and falls back to a deterministic (non-AI)
# analysis if none are configured or all fail.
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=

# Optional — mutual fund data provider (see below). Not required: the
# default works with zero keys.
MFAPI_BASE_URL=              # override if you self-host an AMFI mirror
MUTUAL_FUND_MCP_SERVER_URL=  # point at a standalone MCP server instead of the built-in in-process one
```

## Mutual fund data / MCP integration

Sutra AI can search real Indian mutual funds and fetch NAV/returns/category
mid-conversation, and — for signed-in users with a saved portfolio — add,
update, or remove fund holdings by chatting with it.

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

Portfolio mutations from chat (add/update/remove a fund) only ever write to
Invesutra's own Supabase-backed portfolio tracker. They never place a real
brokerage order.

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
