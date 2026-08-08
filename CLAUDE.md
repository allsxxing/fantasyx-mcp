# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**FantasyX-MCP** is a League HQ for the Sleeper fantasy football league **🔟 FOR $10❌**,
published as a remote MCP server on Vercel. It consolidates an existing, scattered corpus
(iCloud, Google Drive, a ChatGPT export) into a structured, versioned, queryable form — it
does **not** invent league content. The single source of truth for that corpus is:

```
~/Library/Mobile Documents/com~apple~CloudDocs/🎰PICK$!/🏆FANTASY!/
```

Pipeline: **Local Claude Code → GitHub (public) → Vercel → publish as MCP connector.** Each
phase is gated on an observed result before the next begins.

> Status: **Phase 1 complete, all gates green.** 1a content import (`validate-content.mjs` 22/22);
> 1b Sleeper sync (champions resolve: 2025 = AJk12, 2024 = flamezdawson); 1c MCP server — 13 public
> tools + 15 resources all execute over Streamable HTTP, admin endpoint returns 401 on bad/missing
> token and 200 on the good one, `next build` + `tsc --noEmit` clean. **Next: Phase 2 (git init +
> full-tree secret scan before first push).** Approved plan at
> `~/.claude/plans/project-fantasyx-mcp-fantasy-peppy-globe.md`. Keep this file matching reality.

## The three-way data split drives every decision

- **What Sleeper knows** — rosters, standings, matchups, transactions, drafts, scoring.
  Fetched live from the public API. **Never hand-typed.**
- **What only the league knows** — bylaws, the X Champion mechanic, dues, commissioner
  voice, chat templates, lore. These are the flat Markdown/JSON files in `content/`.
- **What nothing currently tracks** — the X Champion lineage (`content/x-champion-log.json`).
  This is the project's real justification; neither Sleeper nor Flaim can answer it.

## Hard rules specific to this repo

- **Sleeper needs no credentials.** The read API is public and unauthenticated. There is no
  API key. Rate limit is 1000/min. Do not add auth to the Sleeper client.
- **`/v1/players/nfl` (~5MB, "call at most once daily")** must be trimmed to
  `{player_id, full_name, position, team}` at build time. Do **not** runtime-cache the raw
  response — it exceeds Vercel's 2MB Data Cache per-entry limit.
- **No runtime filesystem reads.** `content/` is compiled into a generated module at build
  time (`build-content.mjs`) and bundled. Reading `content/` at request time is the classic
  "works locally, 404s on Vercel" output-file-tracing trap — do not do it.
- **V4 rules are authoritative — but provisional.** `10_FOR_10X_League_Rules_2026-08-08.md`
  wins over the earlier draft. The X mechanic is **sabotage** (force a FLEX-eligible player
  into the *opponent's* lineup), declared by **Friday 11:59 PM CT** — *not* the earlier "steal
  into your own FLEX" version. The superseded file lives in `content/archive/` with a header
  noting it. Never merge the two; answering this rule wrong is the worst failure mode.
  V4 is a **working guideline, not locked** (`rules.meta.json` → `status: work_in_progress`).
  Downstream tools must surface rules as provisional. The update path is a single re-sync:
  edit the source doc, run `node scripts/import-icloud.mjs`, commit. `rules.md` is generated —
  never hand-edit it; edit the source and re-import.
- **Private data never enters git.** Payment handles, contacts, dues amounts, and the paid/
  unpaid list live only in the Vercel env var `FANTASYX_PRIVATE_DATA`, read by the bearer-
  gated admin endpoint. Do not invent a LeagueSafe URL or join code — the source export
  explicitly warns against fabricating one.
- **Two endpoints.** `/api/mcp` is public. `/api/admin/mcp` requires `FANTASYX_ADMIN_TOKEN`
  and adds the private fields. The admin URL ends in `/mcp` on purpose: mcp-handler routes by
  the final path segment (basePath `/api/admin`, transport `mcp`) — `/api/mcp/admin` would make
  "admin" the transport and 404. Same reason the public route sits at `/api/mcp`, basePath `/api`.
- **Flaim coexistence.** Flaim MCP is connected and answers league-state questions. The few
  Sleeper-backed tools here are league-scoped and **`fx_`-prefixed** so the model never sees
  two answers to one question. Keep the total tool surface modest (~12–15) — large tool lists
  measurably degrade client tool-selection.

## Architecture

```
content/     league facts. Markdown → MCP resources; JSON → MCP tools.
             x-champion-log.json is the highest-value file. schema/ holds one
             JSON Schema per content type. archive/ holds superseded sources.
src/
  app/api/mcp/route.ts         public endpoint  (mcp-handler, Streamable HTTP, stateless)
  app/api/admin/mcp/route.ts   bearer-gated endpoint (URL /api/admin/mcp — see Stack note)
  lib/content.ts               typed accessors over the generated module (getData/getDocument/…)
  lib/private.ts               parses FANTASYX_PRIVATE_DATA; null when unset (admin degrades)
  connectors/types.ts          shared FantasyConnector iface; sleeper.ts implemented,
                               flaim.ts + leagueloom.ts throw ConnectorNotImplementedError
  tools/index.ts               registerPublicTools (tools + Markdown-as-resources)
  tools/{content,sleeper,admin}-tools.ts   one group per file; admin-tools only on /api/admin/mcp
  tools/helpers.ts             ToolResult wrappers, season→league_id, template var parsing
  generated/content.ts         BUILD OUTPUT (gitignored) — run build-content.mjs if missing
scripts/
  import-icloud.mjs    one-time: iCloud corpus → content/
  sync-sleeper.mjs     Sleeper chain walk (previous_league_id) → seasons/rosters/managers
  build-content.mjs    content/ → generated module; derives manifest from directory listing
  validate-content.mjs every content file against its schema
```

Two levels deep at most. No hand-maintained index files — the manifest is derived.

## Stack

Next.js App Router · `mcp-handler@^1` · `@modelcontextprotocol/sdk@^1.26` · `zod@^3` · Node 20+.
Pin per the **official mcp-handler install line** — the SDK **must be ≥ 1.26.0** (fixes a prior
security advisory) and mcp-handler expects **zod v3**, not v4 (zod v4's schema shape breaks
`inputSchema`). The package is `@modelcontextprotocol/sdk` (not `.../server`). Route exports
`{ handler as GET, handler as POST }`. Tools registered with `server.registerTool(name,
{ title, description, inputSchema }, handler)` where `inputSchema` is a **plain object of zod
validators**, not a `z.object()`. Vercel: Fluid compute on; Deployment Protection **off** in
production (it blocks MCP clients — the bearer is the gate).

## Key league facts (recovered — do not re-derive)

- League ID `1214028632419217409` (2025) · draft `1214028632431808512` · previous (2024)
  `1131889650307706880`. 2026 league `1370188155843526656`.
- 10 teams · full PPR · roster QB/RB/RB/WR/WR/TE/FLEX/FLEX/K/DEF + 8 BN · 6 playoff teams
  from wk 15 · trade deadline wk 11 · $100 FAAB · 1 keeper · 5 veto votes · 2-day trade review.
- Champions (from live API, season complete): **2024 = flamezdawson** (roster 10);
  **2025 = AJk12 / "I'm stuck step Burrow"** (roster 8, user_id `890091625635061760`).
  Do NOT trust the offline export's `latest_league_winner_roster_id: "10"` — that snapshot
  was Week 1 of 2025 and the field was a stale 2024 carryover. `sync-sleeper.mjs` resolves
  champions correctly per completed league.
- 2026 roster: 9/10 filled, one open seat (roster 3). vs 2025: kgamo0527 (r3) and KingCole101
  (r9) left; Nels8951 joined (r9). See `seasons/2026.json` → `roster_changes`.
- Commissioner: allsxxing (user_id `1058575263971250176`, team "ASH & TETTIES").
- Sleeper invite: http://sleeper.com/i/kMgwLBWeYeXdk

## Commands

```bash
npm run dev          # build:content, then next dev — public at :3000/api/mcp
npm run build        # prebuild runs build-content.mjs, then next build
npx tsc --noEmit     # typecheck (no test suite yet; content is validated instead)
npm run validate     # validate-content.mjs — every content file vs its JSON Schema
npm run build:content # content/ → src/generated/content.ts (bundled; never read at runtime)
npm run import:icloud # RE-SYNC path for rules: edit source doc, run this, commit the diff
npm run sync:sleeper  # walk previous_league_id chain → seasons/*.json (champions, roster diffs)
```

`npm run dev` needs no env vars for the public endpoint. To exercise the admin endpoint locally,
prefix with `FANTASYX_ADMIN_TOKEN=… FANTASYX_PRIVATE_DATA='{…}'` (shape in `.env.example`).

**Verify the server** with the MCP Inspector (`npx @modelcontextprotocol/inspector` at
`127.0.0.1:6274`, Streamable HTTP → `http://localhost:3000/api/mcp`), or by POSTing JSON-RPC and
parsing the SSE `data:` line — the endpoint replies `text/event-stream` and the stream stays open,
so always cap curl with `--max-time`. There is no `server.tool()`/plain-JSON shortcut here.

**Dependency audit:** `npm audit` shows highs in `sharp`/`postcss`/`@hono/node-server` — all
transitive Next-15 build deps outside the request path (next/image unused, Windows-only for hono),
fixable only by `next@16` which conflicts with `mcp-handler`'s pinned Next 15. **Left as accepted
risk** — do not `npm audit fix --force`. The security-relevant pin (SDK ≥ 1.26) is satisfied.

## Phase gates (observed results, not "it ran")

1. ✅ **1a** content import; `validate-content.mjs` passes; `rules.md` matches V4. ✅ **1b**
   Sleeper sync; 2025 champion resolves to a real manager. ✅ **1c** MCP server; every tool
   executes, admin rejects a bad token and accepts a good one.
2. **GitHub** (next) public repo; secret scan of the full tree before first push; diff-by-diff
   review. Repo is not yet `git init`'d — do that here, and confirm `.gitignore` covers `.env*`,
   `node_modules/`, `.next/`, and `src/generated/` before the first `git add`.
3. **Vercel** both env vars set as Production; Inspector connects to the public URL.
4. **Publish** as a claude.ai connector and via `claude mcp add --transport http`.
