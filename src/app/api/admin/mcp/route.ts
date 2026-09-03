// ADMIN MCP endpoint — /api/admin/mcp. Everything the public endpoint has, PLUS private dues
// status and contacts. Gated by a static bearer token (FANTASYX_ADMIN_TOKEN); OAuth via
// withMcpAuth's verifyToken is the documented upgrade path if this ever needs per-user identity.
//
// The URL ends in /mcp because mcp-handler treats the final path segment as the transport name —
// basePath is /api/admin. Deployment Protection must stay OFF in production; this bearer is the gate.
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { tokensMatch } from "@/lib/auth";
import { registerAdminTools, registerPublicTools } from "@/tools";

const handler = createMcpHandler(
  (server) => {
    registerPublicTools(server);
    registerAdminTools(server);
  },
  {
    serverInfo: { name: "fantasyx-mcp-admin", version: "0.1.0" },
    capabilities: { tools: {}, resources: {} },
    instructions:
      "Commissioner (admin) view of the 🔟 FOR $10❌ League HQ. Includes every public tool plus " +
      "fx_admin_get_dues_status and fx_admin_get_contacts, which read private data. Treat contact " +
      "info and payment handles as confidential.",
  },
  {
    basePath: "/api/admin",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  const expected = process.env.FANTASYX_ADMIN_TOKEN;
  // Fail closed: with no token configured, the admin endpoint is unusable rather than open.
  if (!expected || expected.trim() === "") return undefined;
  if (!bearerToken || !tokensMatch(bearerToken, expected)) return undefined;

  return {
    token: bearerToken,
    scopes: ["fantasyx:admin"],
    clientId: "fantasyx-commissioner",
    extra: { role: "commissioner" },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["fantasyx:admin"],
});

export { authHandler as GET, authHandler as POST };
