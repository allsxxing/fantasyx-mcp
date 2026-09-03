// Grok-bridge MCP endpoint — /api/grok/mcp. Bearer-gated (FANTASYX_GROK_TOKEN, personal use
// only). Bundles native fx_* tools plus proxied flaim__*/fp__* tools from personal upstream
// OAuth connections (see src/connectors/mcp-proxy.ts). Each proxy source has its own kill switch
// (FLAIM_ENABLED / FANTASYPROS_ENABLED) so either can be dark-launched or cut without a redeploy.
//
// This is intentionally a SEPARATE endpoint from /api/mcp — the public endpoint stays byte-stable
// (same 13 tools, no auth) so existing Claude Code/ChatGPT/Perplexity connections never see a
// registered-tool-list change. basePath must match this route's directory, and the final path
// segment must be `mcp` (mcp-handler treats it as the transport name).
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { tokensMatch } from "@/lib/auth";
import { registerPublicTools } from "@/tools";
import { registerProxyTools } from "@/tools/proxy-tools";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

const handler = createMcpHandler(
  (server) => {
    registerPublicTools(server);
    registerProxyTools(server, "flaim", "flaim__", "FLAIM_ENABLED");
    registerProxyTools(server, "fantasypros", "fp__", "FANTASYPROS_ENABLED");
  },
  {
    serverInfo: { name: "fantasyx-mcp-grok", version: "0.1.0" },
    capabilities: { tools: {}, resources: {} },
    instructions:
      "League HQ for the Sleeper fantasy football league 🔟 FOR $10❌, bundled with the " +
      "commissioner's personal Flaim (flaim__*) and FantasyPros (fp__*) connections where " +
      "enabled. Use fx_get_rules for any rules question (LOCKED V5 ruleset; the X mechanic is " +
      "SABOTAGE, not theft). flaim__* and fp__* answer questions about other connected leagues " +
      "and player rankings/projections respectively — they are personal, single-user proxies, " +
      "not shared league data.",
  },
  {
    basePath: "/api/grok",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  const expected = process.env.FANTASYX_GROK_TOKEN;
  // Fail closed: with no token configured, this endpoint is unusable rather than open.
  if (!expected || expected.trim() === "") return undefined;
  if (!bearerToken || !tokensMatch(bearerToken, expected)) return undefined;

  return {
    token: bearerToken,
    scopes: ["fantasyx:grok"],
    clientId: "fantasyx-grok-bridge",
    extra: { role: "commissioner" },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["fantasyx:grok"],
});

async function withCors(request: Request): Promise<Response> {
  const response = await authHandler(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function HEAD(): Response {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export { withCors as GET, withCors as POST };
