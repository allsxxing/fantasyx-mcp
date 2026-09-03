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

> Status: **✅ ALL PHASES COMPLETE.** Phase 1: content import (`validate-content.mjs` 22/22 ✓),
> Sleeper sync (champions resolve: 2025 = AJk12, 2024 = flamezdawson ✓), MCP server — 13 public
> tools + 15 resources execute over Streamable HTTP, admin endpoint returns 401/200 per token ✓,
> `next build` + `tsc --noEmit` clean ✓. Phase 2: repo pushed to GitHub (`allsxxing/fantasyx-mcp`,
> private ✓). Phase 3: deployed to Vercel production `https://fantasyx-mcp.vercel.app` — both env
> vars set, SSO protection off, `initialize` returns valid JSON-RPC ✓. Phase 4: published as
> claude.ai connector + `claude mcp add --transport http https://fantasyx-mcp.vercel.app/api/mcp` ✓
> Approved plan at `~/.claude/plans/project-fantasyx-mcp-fantasy-peppy-globe.md`.

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
- **V5 rules are authoritative and locked.** `10_FOR_10X_League_Rules_2026-08-11.md` is current
  (`rules.meta.json` → `status: locked`). The X mechanic is **sabotage** (force a FLEX-eligible
  player into the *opponent's* lineup), declared by **Friday 11:59 PM CT** — *not* the earlier
  "steal into your own FLEX" version from the superseded draft. The superseded file lives in
  `content/archive/rules-2026-draft-superseded.md` with a header noting it. Never merge the two;
  answering this rule wrong is the worst failure mode. The update path is a single re-sync: edit
  the source doc, run `node scripts/import-icloud.mjs`, commit. `rules.md` is generated — never
  hand-edit it; edit the source and re-import. **As of 2026-09-02 the source `.md` that
  `import-icloud.mjs` reads (`10_FOR_10X_League_Rules_2026-08-11.md`) is missing from the iCloud
  corpus** — only superseded drafts remain there. A full-text copy survives as the `.docx`
  Claude committed in `bb5a80f` (`content/10_FOR_10X_League_Rules_2026.md.docx`); it confirms
  the poll's real option set is **1X/2.5X/5X/10X/OTHER**, not just the 3 options some chat
  templates surface. Restore the `.md` to iCloud (or point `FANTASYX_CORPUS` at wherever it
  lives now) before trusting a fresh `import:icloud` run.
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
  measurably degrade client tool-selection. Flaim's hosted endpoint is `https://api.flaim.app/mcp`,
  reached via an already-authenticated MCP connector — do not `claude mcp add` a second `flaim`
  entry; it would be an unauthenticated duplicate of a working connection, not a fix. A
  source-reference clone lives at `/Volumes/X10PRO/⚡ClaudeCode/Projects/flaim` — a separate repo,
  never vendored, never a dependency of this build, not run locally. Division of labor: Flaim = live multi-platform
  league state (ESPN/Yahoo/Sleeper, read-only); FantasyX = league-only knowledge Sleeper
  doesn't hold (rules, dues, voice, X-Champion log).

## Content ownership (FantasyX)

`content/rules.md` is the **single source of truth** for the full Rundown. It is GENERATED
by `scripts/import-icloud.mjs` from the iCloud source doc — never hand-edit it. The update
path is always: edit the source doc → `npm run import:icloud` → commit the diff.

| Surface | Role | Edit rule |
|---|---|---|
| `content/rules.md` | Generated master — full Rundown, all sections | Never hand-edit. Re-import instead. |
| ❌-Belt / Season Details / Taglines | **Derived presentation slices** extracted from `rules.md` at render time by `src/lib/rules-sections.ts` | Not editable. Change the heading text in the source doc and re-import. |
| `content/commissioner-note.json` | Sleeper-adjusted shortened Rundown (structured rows) | Editable directly. Must never contradict `rules.md`; it is a summary, not an authority. |
| `content/seasons/*.json`, `content/managers.json` | Generated by `npm run sync:sleeper` — rosters, champions, draft, draft order | Never hand-edit. Re-sync instead. |

**Hard rule — Sleeper data:** `sync:sleeper` is the only writer of `content/seasons/*.json` and
`content/managers.json`. Never hand-enter roster or draft data (a screenshot is not a source),
and never add a second file restating it — commit `810d548` did both and produced a schema
failure plus two conflicting 2026 rosters served over MCP. Draft order comes from
`/v1/draft/{draft_id}` and is `null` until Sleeper randomizes it; a null order is the correct
answer, an invented one is not. See `docs/plans/2026-08-16-sleeper-sync-automation-design.md`.

**Hard rule:** there is exactly one authority for any given rule — `rules.md`. Never create a
second Markdown file restating the X mechanic, the multiplier options, or the declaration
deadline. A second file WILL drift and WILL be served as a conflicting MCP resource.
`content/X-Belt.md` was retired to `content/archive/` for exactly this reason.

## Architecture

```
content/     league facts. Markdown → MCP resources; JSON → MCP tools.
             x-champion-log.json is the highest-value file. schema/ holds one
             JSON Schema per content type. archive/ holds superseded sources.
src/
  app/page.tsx                 async Server Component — retro-brutalist landing page
                               reads generated league data from @/lib/content (build-time bundle)
  app/globals.css              retro-brutalist skin (plain CSS, no Tailwind) — CRT scanlines,
                               dot grid, window frames, marquee; consumes font variables from layout.tsx.
                               Never add Tailwind — incompatible with mcp-handler's pinned Next 15.
  app/layout.tsx               configures next/font/google (Space_Mono + Syne); generates CSS
                               variables consumed by globals.css
  components/retro-chrome.tsx  "use client" — live SYS_UP clock + scroll-to-top button;
                               all browser-only effects isolated here so page.tsx stays a
                               Server Component.
  components/terminal-block.tsx  reusable <TerminalBlock title commands cursor preserveCase>
                               renders content as a terminal window (prompt + command + output
                               lines). Every terminal-styled section on the page (X mechanic,
                               season config, commish note, etc.) goes through this — don't
                               hand-roll a new .terminal-section block.
  lib/rules-sections.ts        pure Markdown transforms over the generated rules.md body:
                               splitSections/sectionBullets/getSection (extract a named
                               section), stripHeadingNumbers, promoteBoldLabelsToHeadings,
                               removeSections (display-only cleanup, never mutates the source).
                               Unit-tested in test/rules-sections.test.mjs.
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
`{ withCors as GET, withCors as POST }`. Tools registered with `server.registerTool(name,
{ title, description, inputSchema }, handler)` where `inputSchema` is a **plain object of zod
validators**, not a `z.object()`. Vercel: Fluid compute on; Deployment Protection **off** in
production (it blocks MCP clients — the bearer is the gate).

Two non-obvious workarounds in `src/app/api/mcp/route.ts` that must not be removed:
1. **CORS wrapper** — `mcp-handler` adds no CORS headers on the main route (only on OAuth metadata
   endpoints). Browser-based MCP clients (e.g. Gemini custom connected apps) fetch the URL directly
   from the browser page and are blocked by the browser before the request reaches Vercel without
   `Access-Control-Allow-Origin: *`. The `withCors` wrapper adds these headers to every response.
2. **Explicit HEAD export** — without it, Next.js derives HEAD from GET and routes it into
   `mcp-handler`, which hangs indefinitely on a bodyless request. Any client that probes reachability
   with HEAD (common before opening a full MCP session) sees the URL as unreachable. The explicit
   `export function HEAD()` returns 200 immediately.

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
npx tsc --noEmit     # typecheck
npm test              # node --experimental-strip-types --test test/*.test.mjs — pure-function
                       # unit tests (currently rules-sections.ts); content itself is validated
                       # separately via `npm run validate`, not unit-tested
npm run validate     # validate-content.mjs — every content file vs its JSON Schema
npm run build:content # content/ → src/generated/content.ts (bundled; never read at runtime)
npm run import:icloud # RE-SYNC path for rules: edit source doc, run this, commit the diff
npm run sync:sleeper  # walk previous_league_id chain → seasons/*.json + managers.json
                       # (champions, roster diffs, draft, draft order). Also runs on a schedule
                       # via .github/workflows/sync-sleeper.yml — validate gates every commit.
```

To run a single test file: `node --experimental-strip-types --test test/rules-sections.test.mjs`.

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

## Automated Sleeper sync (GitHub Actions)

`.github/workflows/sync-sleeper.yml` runs `npm run sync:sleeper` on a cron and **commits +
pushes `content/` directly as `github-actions[bot]`** when Sleeper state changed — expect
unattributed `sync: Sleeper league state YYYY-MM-DD` commits in `git log` that nobody in this
session authored. The cron fires year-round on three schedules but self-gates to one active
phase by date (preseason/draft daily, in-season Tuesdays, offseason monthly) since GitHub cron
has no per-date conditionals — an out-of-phase firing exits as a no-op. It never pushes content
that fails `npm run validate`. Vercel is git-connected, so each of these commits triggers a
production redeploy same as a human push.

## Phase gates (observed results, not "it ran")

1. ✅ **1a** content import; `validate-content.mjs` passes; `rules.md` matches V4. ✅ **1b**
   Sleeper sync; 2025 champion resolves to a real manager. ✅ **1c** MCP server; every tool
   executes, admin rejects a bad token and accepts a good one.
2. ✅ **GitHub** repo pushed to `allsxxing/fantasyx-mcp` (private); secret scan clean; `.gitignore`
   covers `.env*`, `node_modules/`, `.next/`, `src/generated/`.
3. ✅ **Vercel** deployed to `https://fantasyx-mcp.vercel.app`; both env vars set as Production;
   SSO protection off; `initialize` returns valid JSON-RPC over SSE.
4. **Publish** as a claude.ai connector and via `claude mcp add --transport http https://fantasyx-mcp.vercel.app/api/mcp`.
