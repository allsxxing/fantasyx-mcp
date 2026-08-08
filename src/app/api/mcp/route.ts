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

export { handler as GET, handler as POST };
