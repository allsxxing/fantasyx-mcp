# FantasyX MCP

**League HQ + remote MCP server for the Sleeper fantasy football league 🔟 FOR $10❌**

Versioned bylaws, the signature ❌ Champion sabotage mechanic, dues, season history, and live Sleeper data — all queryable by any MCP client.

**Live:** [https://fantasyx-mcp.vercel.app](https://fantasyx-mcp.vercel.app)  
**MCP Endpoint:** `https://fantasyx-mcp.vercel.app/api/mcp`

---

## Quick Connect

### Claude Desktop / Claude Code
```json
{
  "mcpServers": {
    "fantasyx": {
      "type": "http",
      "url": "https://fantasyx-mcp.vercel.app/api/mcp"
    }
  }
}
```

### CLI
```bash
claude mcp add --transport http https://fantasyx-mcp.vercel.app/api/mcp
```

### Cursor / other Streamable HTTP clients
Point your MCP config at the same URL. The server speaks Streamable HTTP and returns proper SSE.

---

## What it does

| Feature | Description |
|---------|-------------|
| **❌ Champion Belt** | Tracks the weekly sabotage FLEX mechanic (Week 1 highest scorer → forced FLEX lock every week after) |
| **Versioned Rules** | Full 2026 league bylaws served as MCP resources + tools |
| **Dues & Multiplier** | Buy-in + X-multiplier poll status (LeagueSafe) |
| **Season History** | Champions, roster changes, previous league IDs |
| **Sleeper Sync** | Live league/roster data via public Sleeper API (no auth required) |
| **Commissioner Tools** | Chat templates, admin workflow, X-declaration helpers |
| **Retro League HQ** | Brutalist landing page with terminal aesthetic |

---

## Available Surface

**Public tools** (`/api/mcp`)  
~13 tools covering rules, X-champion log, dues, seasons, managers, chat templates, and league facts.

**Resources**  
Markdown bylaws, scoring, voice guidelines, commissioner docs, and structured JSON (league, seasons, managers, dues, x-champion-log).

**Admin endpoint** (`/api/admin/mcp`)  
Bearer-gated. Adds private payment status + contact data (never committed to git).

**Live scores** (`/api/live/mcp`) — opt-in, off by default  
Returns 404 unless `FANTASYX_LIVE` is exactly `1`. When the flag is on, requires `Authorization: Bearer <FANTASYX_LIVE_TOKEN>` (401 otherwise). Exposes only `nfl_state`, `live_matchups`, and `live_standings` from the public Sleeper API, with a 60-second in-memory cache. The public `/api/mcp` endpoint is unchanged.

---

## Local Development

```bash
git clone https://github.com/allsxxing/fantasyx-mcp.git
cd fantasyx-mcp
npm install
npm run dev
```

Public MCP available at `http://localhost:3000/api/mcp`.

Live scores stay off unless you export `FANTASYX_LIVE=1` and `FANTASYX_LIVE_TOKEN` (see `.env.example`). With the flag unset, `http://localhost:3000/api/live/mcp` returns 404.

```bash
# Useful scripts
npm run build:content   # compile content/ → generated module
npm run validate        # schema validation on every content file
npm run sync:sleeper    # refresh seasons + champions from Sleeper API
npm run import:icloud   # re-sync rules from source document
```

---

## Claude Code on the web

- Connect this repo at [claude.ai/code](https://claude.ai/code).
- Set the env vars listed in `.env.example` in the cloud environment's own secret settings — not in a global shell profile.
- Node 22 is required.
- Sessions can be driven from the Claude iPhone app and open PRs.
- Permissions live in `.claude/settings.json`: pushes, merges, and deploys always ask first. Personal overrides go in `.claude/settings.local.json` (gitignored).

---

## Architecture

```
content/          → single source of truth (Markdown + JSON)
scripts/          → build-content, validate, sync-sleeper, import
src/app/page.tsx  → League HQ landing page (Server Component)
src/app/api/mcp   → public Streamable HTTP endpoint
src/app/api/admin → bearer-protected admin endpoint
src/app/api/live  → opt-in live scores (FANTASYX_LIVE=1 + bearer token)
src/tools/        → tool registration (public, admin, and opt-in live)
src/lib/content   → typed accessors over build-time generated module
```

Content is compiled at build time. No runtime filesystem reads (Vercel-safe).

---

## Stack

- Next.js 15 (App Router)
- `mcp-handler` + `@modelcontextprotocol/sdk` ≥ 1.26
- Zod v3
- Streamable HTTP (stateless)
- Deployed on Vercel

---

## League

**🔟 FOR $10❌**  
10-team re-draft · Full PPR · Snake draft · 6 playoff teams · Winner-take-all  
Signature mechanic: **The ❌ Belt** (weekly forced FLEX sabotage)

Commissioner: [@allsxxing](https://x.com/allsxxing)

---

## License

Private for now. Contact the commissioner if you want to fork or adapt for your own league.
