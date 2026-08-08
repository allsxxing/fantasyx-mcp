// Composition point for the two endpoints. Public tools are shared; admin tools are additive
// and registered only on the bearer-gated route. Total public surface stays ~13 tools — large
// tool lists measurably degrade client tool-selection.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDocument, listDocuments } from "@/lib/content";
import { registerAdminTools } from "./admin-tools";
import { registerContentTools } from "./content-tools";
import { registerSleeperTools } from "./sleeper-tools";

export { registerAdminTools };

/**
 * Expose every bundled Markdown doc as a readable MCP resource, so clients can pull rules,
 * voice, templates, and commissioner docs without spending a tool call.
 */
function registerDocumentResources(server: McpServer): void {
  for (const key of listDocuments()) {
    const doc = getDocument(key);
    if (!doc) continue;
    server.registerResource(
      key,
      `fantasyx://${key}`,
      {
        title: doc.frontmatter.title ?? key,
        description: `League HQ document: ${doc.path}`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: doc.body }],
      }),
    );
  }
}

/** Tools + resources available on BOTH endpoints. */
export function registerPublicTools(server: McpServer): void {
  registerContentTools(server);
  registerSleeperTools(server);
  registerDocumentResources(server);
}
