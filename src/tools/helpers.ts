// Shared helpers for tool handlers: result wrappers + small content lookups.
import { getData } from "@/lib/content";

/** Structurally compatible with the SDK's CallToolResult (text content only). */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Season chain covered by this HQ. */
export const SEASONS = ["2024", "2025", "2026"] as const;
export type Season = (typeof SEASONS)[number];

/** Resolve a season's Sleeper league id from bundled content. */
export function seasonLeagueId(season: string): string | undefined {
  return getData<{ league_id?: string }>(`seasons/${season}`)?.league_id;
}

/** Frontmatter stores template variables as "[a, b, c]"; return them as a clean array. */
export function parseVariables(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
