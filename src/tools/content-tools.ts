// League-knowledge tools backed by bundled content (no network). These answer the things only
// the league knows: rules, dues, managers, the X Champion belt, chat templates, commissioner ops.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getData,
  getDocument,
  listDocuments,
  manifest,
  requireData,
} from "@/lib/content";
import { parseIcs, upcoming } from "@/lib/ics";
import {
  SEASONS,
  errorResult,
  jsonResult,
  parseVariables,
  textResult,
} from "./helpers";

interface LeagueCalendarLinks {
  label?: string;
  ics_url?: string | null;
  google_url?: string | null;
  webcal_url?: string | null;
}

interface RulesMeta {
  version: string;
  status: string;
  locked: boolean;
  note: string;
  update_workflow: string;
}

export function registerContentTools(server: McpServer): void {
  server.registerTool(
    "fx_get_rules",
    {
      title: "Get league rules",
      description:
        "The canonical, LOCKED V5 rules for 🔟 FOR $10❌, including the X Champion sabotage mechanic. " +
        "Use this for any rules question, especially the sabotage-vs-theft distinction.",
    },
    async () => {
      const doc = getDocument("rules");
      const meta = getData<RulesMeta>("rules.meta");
      if (!doc) return errorResult("rules.md not found in bundled content.");
      const banner = meta
        ? `${meta.locked ? "✅ LOCKED" : "⚠️ PROVISIONAL"} RULES — status: ${meta.status} (version ${meta.version}, locked: ${meta.locked}). ${meta.note}\n\n---\n\n`
        : "";
      return textResult(banner + doc.body);
    },
  );

  server.registerTool(
    "fx_get_league_info",
    {
      title: "Get league info",
      description:
        "League identity, Sleeper IDs, the 2024→2026 season chain, settings (teams, playoffs, " +
        "FAAB, keepers, veto votes), roster slots, and full PPR scoring settings.",
    },
    async () => jsonResult(requireData("league")),
  );

  server.registerTool(
    "fx_list_managers",
    {
      title: "List current managers",
      description:
        "The current (2026) league members with team names, plus open spots and roster changes " +
        "vs. last season. Commissioner is flagged.",
    },
    async () => {
      const season = requireData<{
        season: string;
        num_teams: number;
        member_count: number;
        members: Array<{ user_id: string; display_name: string; team_name: string | null; roster_id: number }>;
        roster_changes?: unknown;
      }>("seasons/2026");
      const league = requireData<{ commissioner: { user_id: string } }>("league");
      const commishId = league.commissioner.user_id;
      return jsonResult({
        season: season.season,
        num_teams: season.num_teams,
        member_count: season.member_count,
        managers: season.members.map((m) => ({
          ...m,
          is_commissioner: m.user_id === commishId,
        })),
        roster_changes: season.roster_changes ?? null,
      });
    },
  );

  server.registerTool(
    "fx_get_season",
    {
      title: "Get a season",
      description:
        "A specific season's record: status, members, and champion (resolved live from Sleeper " +
        "for completed seasons). Season-level champion only — for the weekly X belt use fx_get_x_champion_log.",
      inputSchema: { season: z.enum(SEASONS).describe("Season year: 2024, 2025, or 2026") },
    },
    async ({ season }) => {
      const data = getData(`seasons/${season}`);
      if (!data) return errorResult(`No data for season ${season}. Available: ${manifest.seasons.join(", ")}`);
      return jsonResult(data);
    },
  );

  server.registerTool(
    "fx_get_champions",
    {
      title: "Get season champions",
      description:
        "Champion of each completed season across the chain. Note: the weekly X Champion belt is " +
        "separate — use fx_get_x_champion_log for that.",
    },
    async () =>
      jsonResult({
        champions: manifest.seasons.map((year) => {
          const s = getData<{ status?: string; champion?: unknown }>(`seasons/${year}`);
          return { season: year, status: s?.status ?? null, champion: s?.champion ?? null };
        }),
        note: "Weekly X Champion belt lineage is tracked separately via fx_get_x_champion_log.",
      }),
  );

  server.registerTool(
    "fx_get_x_champion_log",
    {
      title: "Get X Champion belt log",
      description:
        "The X Champion belt lineage — the league's signature weekly mechanic that nothing else " +
        "tracks. Who held the belt each week, which FLEX player they forced into their opponent's " +
        "lineup (sabotage), and when it was declared. THE authoritative source for the X belt.",
    },
    async () => jsonResult(requireData("x-champion-log")),
  );

  server.registerTool(
    "fx_get_scoring",
    {
      title: "Get scoring settings",
      description: "Human-readable scoring rules (full PPR incl. DST/K), derived from the league settings.",
    },
    async () => {
      const doc = getDocument("scoring");
      return doc ? textResult(doc.body) : errorResult("scoring.md not found in bundled content.");
    },
  );

  server.registerTool(
    "fx_get_dues",
    {
      title: "Get dues (public)",
      description:
        "Public dues info: base buy-in, winner-take-all structure, and X-multiplier poll status. " +
        "Paid/unpaid status, payment handles, and contacts are PRIVATE and only available on the admin endpoint.",
    },
    async () => jsonResult(requireData("dues")),
  );

  server.registerTool(
    "fx_list_chat_templates",
    {
      title: "List chat templates",
      description:
        "Available league chat templates (dues reminder, X crowning/declaration, trade veto poll, " +
        "weekly recap, etc.) with their titles and fillable variables. Render one with fx_render_chat_template.",
    },
    async () =>
      jsonResult(
        listDocuments("chat-templates/").map((key) => {
          const doc = getDocument(key);
          return {
            name: key.replace("chat-templates/", ""),
            title: doc?.frontmatter.title ?? key,
            variables: parseVariables(doc?.frontmatter.variables),
          };
        }),
      ),
  );

  server.registerTool(
    "fx_render_chat_template",
    {
      title: "Render a chat template",
      description:
        "Fill a chat template's {{variables}} and return the ready-to-post message in the " +
        "commissioner's voice. Any unfilled variables are left as {{name}} and listed at the end.",
      inputSchema: {
        name: z.string().describe('Template name, e.g. "dues-reminder" (see fx_list_chat_templates)'),
        variables: z
          .record(z.string())
          .optional()
          .describe('Values keyed by variable name, e.g. {"amount":"$25","method":"LeagueSafe"}'),
      },
    },
    async ({ name, variables }) => {
      const doc = getDocument(`chat-templates/${name}`);
      if (!doc) {
        const available = listDocuments("chat-templates/").map((k) => k.replace("chat-templates/", ""));
        return errorResult(`Unknown template "${name}". Available: ${available.join(", ")}`);
      }
      const vars = variables ?? {};
      const missing = new Set<string>();
      const rendered = doc.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
        if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key];
        missing.add(key);
        return `{{${key}}}`;
      });
      const footer = missing.size ? `\n\n[unfilled variables: ${[...missing].join(", ")}]` : "";
      return textResult(rendered + footer);
    },
  );

  server.registerTool(
    "fx_get_commissioner_doc",
    {
      title: "Get a commissioner doc",
      description:
        "Operational commissioner playbooks: preseason checklist, X-admin workflow, veto process, " +
        "payout structure, season timeline.",
      inputSchema: {
        name: z
          .string()
          .describe('Doc name, e.g. "preseason-checklist", "x-admin-workflow", "veto-process"'),
      },
    },
    async ({ name }) => {
      const doc = getDocument(`commissioner/${name}`);
      if (!doc) {
        const available = listDocuments("commissioner/").map((k) => k.replace("commissioner/", ""));
        return errorResult(`Unknown commissioner doc "${name}". Available: ${available.join(", ")}`);
      }
      return textResult(doc.body);
    },
  );

  server.registerTool(
    "fx_get_calendar",
    {
      title: "🏆 Get the league calendar",
      description:
        "The league's live 🏆 subscribable calendar (draft day, deadlines, playoffs). The calendar " +
        "itself is maintained in Google Calendar so the commissioner can update dates without a code " +
        "deploy; this tool fetches that calendar's public ICS feed live and returns upcoming events " +
        "plus the Apple/Google/raw-ICS subscribe links. If the feed can't be fetched, it still returns " +
        "the subscribe links so the calendar remains reachable.",
    },
    async () => {
      const links = getData<{ league_calendar?: LeagueCalendarLinks }>("links");
      const cal = links?.league_calendar;
      const subscribeLinks = {
        label: cal?.label ?? "🏆 10 FOR $10❌ 2026",
        google: cal?.google_url ?? null,
        apple_webcal: cal?.webcal_url ?? null,
        ics: cal?.ics_url ?? null,
      };

      if (!cal?.ics_url) {
        return jsonResult({
          ...subscribeLinks,
          events: [],
          note: "Calendar not yet configured — no ICS URL set in links.json league_calendar.ics_url.",
        });
      }

      try {
        const res = await fetch(cal.ics_url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
        const raw = await res.text();
        const events = upcoming(parseIcs(raw));
        return jsonResult({ ...subscribeLinks, events });
      } catch (err) {
        return jsonResult({
          ...subscribeLinks,
          events: [],
          note: `Could not fetch live calendar feed (${err instanceof Error ? err.message : "unknown error"}); subscribe links still work.`,
        });
      }
    },
  );
}
