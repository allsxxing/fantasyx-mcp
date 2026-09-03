// Registers a proxied upstream's snapshotted tools onto our server, prefixed to avoid collisions
// (flaim__*, fp__* — both upstreams independently define get_roster/get_league_info/etc., and
// both would also collide with nothing native since every fx_* tool is already prefixed).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getData } from "@/lib/content";
import { jsonSchemaToZodShape, type JsonSchemaObject } from "@/lib/jsonschema-to-zod";
import { errorResult, jsonResult, type ToolResult } from "./helpers";
import { callUpstreamTool, type UpstreamName } from "@/connectors/mcp-proxy";

interface UpstreamToolDef {
  name: string;
  description?: string;
  inputSchema?: JsonSchemaObject;
}

interface UpstreamSnapshot {
  upstream: string;
  tools: UpstreamToolDef[];
}

function readAllowlist(): Set<string> | null {
  const raw = process.env.GROK_TOOL_ALLOWLIST;
  if (!raw || raw.trim() === "") return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/** Registers every snapshotted tool for `upstream`, gated by an env kill switch. */
export function registerProxyTools(
  server: McpServer,
  upstream: UpstreamName,
  prefix: string,
  enabledEnvVar: string,
): void {
  if (process.env[enabledEnvVar] !== "true") return;

  const snapshot = getData<UpstreamSnapshot>(`upstream-tools/${upstream}`);
  if (!snapshot) return;

  const allowlist = readAllowlist();

  for (const tool of snapshot.tools) {
    const registeredName = `${prefix}${tool.name}`;
    if (allowlist && !allowlist.has(registeredName)) continue;

    let inputSchema: Record<string, z.ZodTypeAny>;
    try {
      inputSchema = jsonSchemaToZodShape(tool.inputSchema);
    } catch (err) {
      // A schema this converter can't express must not silently drop args at runtime.
      console.warn(
        `[proxy-tools] skipping ${registeredName}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    server.registerTool(
      registeredName,
      {
        title: tool.name,
        description: tool.description ?? `Proxied ${upstream} tool: ${tool.name}`,
        ...(Object.keys(inputSchema).length > 0 ? { inputSchema } : {}),
      },
      async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const result = await callUpstreamTool(upstream, tool.name, args ?? {});
          return jsonResult(result);
        } catch (err) {
          return errorResult(
            `Failed to call ${upstream} tool "${tool.name}": ` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      },
    );
  }
}
