// Admin-only tools. Registered ONLY on the bearer-gated /api/admin/mcp endpoint. These read
// private data from the FANTASYX_PRIVATE_DATA env var — it is never in git or in content/.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireData } from "@/lib/content";
import { getPrivateData } from "@/lib/private";
import { jsonResult, textResult } from "./helpers";

const NOT_CONFIGURED =
  "FANTASYX_PRIVATE_DATA is not configured on this deployment, so no private data is available. " +
  "Set it as a Production env var in Vercel (see .env.example for the expected JSON shape).";

export function registerAdminTools(server: McpServer): void {
  server.registerTool(
    "fx_admin_get_dues_status",
    {
      title: "Get dues status (private)",
      description:
        "ADMIN ONLY. Per-manager paid/unpaid dues status from private data, merged with the public " +
        "buy-in structure and X-multiplier status.",
    },
    async () => {
      const priv = getPrivateData();
      if (!priv) return textResult(NOT_CONFIGURED);
      return jsonResult({
        public: requireData("dues"),
        dues_status: priv.dues_status ?? [],
        paid_count: (priv.dues_status ?? []).filter((d) => d.paid).length,
        unpaid: (priv.dues_status ?? []).filter((d) => !d.paid),
      });
    },
  );

  server.registerTool(
    "fx_admin_get_contacts",
    {
      title: "Get manager contacts (private)",
      description:
        "ADMIN ONLY. Private contact info and payment handles for league managers. Never exposed " +
        "on the public endpoint.",
    },
    async () => {
      const priv = getPrivateData();
      if (!priv) return textResult(NOT_CONFIGURED);
      return jsonResult({ contacts: priv.contacts ?? [] });
    },
  );
}
