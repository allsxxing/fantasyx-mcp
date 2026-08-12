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

---

## Local Development

```bash
git clone https://github.com/allsxxing/fantasyx-mcp.git
cd fantasyx-mcp
npm install
npm run dev
```

Public MCP available at `http://localhost:3000/api/mcp`.

```bash
# Useful scripts
npm run build:content   # compile content/ → generated module
npm run validate        # schema validation on every content file
npm run sync:sleeper    # refresh seasons + champions from Sleeper API
npm run import:icloud   # re-sync rules from source document
```

---

## Architecture

```
content/          → single source of truth (Markdown + JSON)
scripts/          → build-content, validate, sync-sleeper, import
src/app/page.tsx  → League HQ landing page (Server Component)
src/app/api/mcp   → public Streamable HTTP endpoint
src/app/api/admin → bearer-protected admin endpoint
src/tools/        → tool registration (content + sleeper + admin)
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
