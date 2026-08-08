// Live Sleeper-backed tools. Deliberately few: Flaim MCP already answers general league-state
// questions, so these are league-scoped and fx_-prefixed to avoid giving the model two answers
// to one question.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sleeper } from "@/connectors/sleeper";
import { requireData } from "@/lib/content";
import { SEASONS, errorResult, jsonResult, seasonLeagueId } from "./helpers";

export function registerSleeperTools(server: McpServer): void {
  server.registerTool(
    "fx_get_standings",
    {
      title: "Get live standings",
      description:
        "Live standings for a season of 🔟 FOR $10❌, fetched from the public Sleeper API: " +
        "record, points for/against, ranked best-first. Defaults to the current season (2026).",
      inputSchema: {
        season: z
          .enum(SEASONS)
          .optional()
          .describe("Season year (2024, 2025, or 2026). Defaults to 2026."),
      },
    },
    async ({ season }) => {
      const year = season ?? "2026";
      const leagueId = seasonLeagueId(year);
      if (!leagueId) return errorResult(`No Sleeper league id known for season ${year}.`);
      try {
        const standings = await sleeper.getStandings(leagueId);
        return jsonResult({ season: year, league_id: leagueId, source: "sleeper", standings });
      } catch (err) {
        return errorResult(
          `Failed to fetch standings from Sleeper: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  server.registerTool(
    "fx_get_links",
    {
      title: "Get league links",
      description:
        "League URLs: Sleeper invite and league pages, FantasyPros. Note leaguesafe is null — no " +
        "LeagueSafe join URL has been verified; do not invent one.",
    },
    async () => jsonResult(requireData("links")),
  );
}
