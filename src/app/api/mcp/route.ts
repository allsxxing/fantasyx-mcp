// PUBLIC MCP endpoint — /api/mcp. No auth: every tool here reads either bundled league content
// or the public, unauthenticated Sleeper read API. Private data lives only behind /api/admin/mcp.
//
// Stateless Streamable HTTP (no Redis). basePath must match this route's directory, and the final
// path segment must be the transport name ("mcp").
import { createMcpHandler } from "mcp-handler";
import { registerPublicTools } from "@/tools";

const handler = createMcpHandler(
  (server) => {
    registerPublicTools(server);
  },
  {
    serverInfo: { name: "fantasyx-mcp", version: "0.1.0" },
    capabilities: { tools: {}, resources: {} },
    instructions:
      "League HQ for the Sleeper fantasy football league 🔟 FOR $10❌. Use fx_get_rules for any " +
      "rules question (rules are provisional and the X mechanic is SABOTAGE — forcing a player " +
      "into the opponent's lineup — not theft). fx_get_x_champion_log is the only source for the " +
      "weekly X Champion belt. Dues paid/unpaid status and contacts are not available here; they " +
      "require the admin endpoint.",
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

// mcp-handler sets no CORS headers on this route (only on its OAuth metadata
// endpoints), so browser-based clients — e.g. Gemini's custom connected apps,
// which fetch this URL directly from the page — are blocked by the browser
// before the request ever reaches Vercel.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

async function withCors(request: Request): Promise<Response> {
  const response = await handler(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Without an explicit HEAD export, Next.js derives HEAD from GET and routes it
// into mcp-handler, which hangs indefinitely on a bodyless HEAD request instead
// of responding — so any client that probes reachability with HEAD (a common
// pattern before opening a full MCP session) sees the URL as unreachable.
export function HEAD(): Response {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export { withCors as GET, withCors as POST };
