// Opt-in live Sleeper scores. Registered only by /api/live/mcp — never by the public
// or admin tool lists. The Sleeper read API is public and unauthenticated.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type NflState = {
  season: string;
  week: number | null;
  season_type: string;
};

type OwnerFields = {
  user_id: string | null;
  display_name: string | null;
  team_name: string | null;
};

const WEEK_MSG = "week must be an integer from 1 to 18";

/** In-memory GET cache keyed by full URL. Entries expire 60 seconds after they are stored. */
export class LiveSleeperCache {
  static readonly ttlMs = 60_000;
  static #entries = new Map<string, { value: unknown; storedAt: number }>();

  static get(url: string, now = Date.now()): unknown | undefined {
    const hit = LiveSleeperCache.#entries.get(url);
    if (!hit) return undefined;
    if (now - hit.storedAt >= LiveSleeperCache.ttlMs) {
      LiveSleeperCache.#entries.delete(url);
      return undefined;
    }
    return hit.value;
  }

  static set(url: string, value: unknown, now = Date.now()): void {
    LiveSleeperCache.#entries.set(url, { value, storedAt: now });
  }

  static clear(): void {
    LiveSleeperCache.#entries.clear();
  }
}

/**
 * Request gate for /api/live/mcp. 404 unless FANTASYX_LIVE is exactly "1".
 * Otherwise 401 unless the bearer token matches FANTASYX_LIVE_TOKEN.
 * Returns null when the request may proceed.
 */
export class LiveGate {
  static deny(request: Request, env: NodeJS.ProcessEnv = process.env): Response | null {
    if (env["FANTASYX_LIVE"] !== "1") {
      return new Response("Not Found", { status: 404 });
    }

    const expected = env["FANTASYX_LIVE_TOKEN"] ?? "";
    if (expected.trim() === "") {
      return LiveGate.#unauthorized();
    }

    const header = request.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
    const presented = match?.[1] ?? "";
    // Compare even when the header is absent so a missing token still pays the compare cost.
    if (!match || !LiveGate.#tokensMatch(presented, expected)) {
      return LiveGate.#unauthorized();
    }
    return null;
  }

  static #unauthorized(): Response {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="fantasyx-live"' },
    });
  }

  /** HMAC both sides so the compare stays constant-time across unequal lengths. */
  static #tokensMatch(a: string, b: string): boolean {
    const digest = (value: string) => createHmac("sha256", "fantasyx-live").update(value).digest();
    return timingSafeEqual(digest(a), digest(b));
  }
}

export class LiveSleeper {
  static readonly baseUrl = "https://api.sleeper.app/v1";
  static timeoutMs = 10_000;

  static readonly leagueIdSchema = z
    .string({
      required_error: "league_id is required",
      invalid_type_error: "league_id is required",
    })
    .regex(/^\d{1,30}$/, "league_id must be a numeric Sleeper league id");

  static readonly weekSchema = z
    .number({ invalid_type_error: WEEK_MSG })
    .int(WEEK_MSG)
    .min(1, WEEK_MSG)
    .max(18, WEEK_MSG)
    .optional();

  static readonly matchupsInput = z.object({
    league_id: LiveSleeper.leagueIdSchema,
    week: LiveSleeper.weekSchema,
  });

  static readonly standingsInput = z.object({
    league_id: LiveSleeper.leagueIdSchema,
  });

  static register(server: McpServer): void {
    server.registerTool(
      "nfl_state",
      {
        title: "NFL state",
        description:
          "Current NFL season, week, and season_type from the public Sleeper API " +
          "(https://api.sleeper.app/v1/state/nfl). No parameters.",
      },
      async () => LiveSleeper.nflState(),
    );

    server.registerTool(
      "live_matchups",
      {
        title: "Live matchups",
        description:
          "Live Sleeper matchups for a league. Optional week defaults to the current NFL week. " +
          "Each side includes roster id, owner display name, team name, points, and starters_points. " +
          "Joined from the league matchups, users, and rosters endpoints.",
        inputSchema: {
          league_id: LiveSleeper.leagueIdSchema,
          week: LiveSleeper.weekSchema,
        },
      },
      async (args) => LiveSleeper.liveMatchups(args),
    );

    server.registerTool(
      "live_standings",
      {
        title: "Live standings",
        description:
          "Live Sleeper standings for a league: wins, losses, ties, points for, and points against " +
          "per roster, sorted by wins then points for. Owner display names and team names are joined " +
          "from the users endpoint.",
        inputSchema: {
          league_id: LiveSleeper.leagueIdSchema,
        },
      },
      async (args) => LiveSleeper.liveStandings(args),
    );
  }

  static async nflState(): Promise<ToolResult> {
    try {
      const state = await LiveSleeper.#loadState();
      return LiveSleeper.#ok(state);
    } catch (err) {
      return LiveSleeper.#fail(err);
    }
  }

  static async liveMatchups(input: unknown): Promise<ToolResult> {
    const parsed = LiveSleeper.#parse(LiveSleeper.matchupsInput, input);
    if (!parsed.ok) return parsed.result;

    try {
      let season: string | null = null;
      let seasonType: string | null = null;
      let week = parsed.data.week;
      if (week === undefined) {
        const state = await LiveSleeper.#loadState();
        season = state.season;
        seasonType = state.season_type;
        if (state.week == null || state.week < 1 || state.week > 18) {
          return LiveSleeper.#error("No current NFL week; pass week explicitly.");
        }
        week = state.week;
      }

      const leagueId = parsed.data.league_id;
      const [matchups, users, rosters] = await Promise.all([
        LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/league/${leagueId}/matchups/${week}`),
        LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/league/${leagueId}/users`),
        LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/league/${leagueId}/rosters`),
      ]);

      const rows = LiveSleeper.#matchupRows(matchups);
      const owners = LiveSleeper.#owners(users, rosters);
      const grouped = new Map<number | null, Array<Record<string, unknown>>>();
      for (const row of rows) {
        const owner = owners.byRoster.get(row.roster_id);
        const side = {
          roster_id: row.roster_id,
          user_id: owner?.user_id ?? null,
          display_name: owner?.display_name ?? null,
          team_name: owner?.team_name ?? null,
          points: row.points,
          starters: row.starters,
          starters_points: row.starters_points,
        };
        const key = row.matchup_id;
        const list = grouped.get(key) ?? [];
        list.push(side);
        grouped.set(key, list);
      }

      const matchupIds = [...grouped.keys()].sort((a, b) => {
        if (a == null) return 1;
        if (b == null) return -1;
        return a - b;
      });

      return LiveSleeper.#ok({
        league_id: leagueId,
        week,
        season,
        season_type: seasonType,
        matchups: matchupIds.map((matchupId) => ({
          matchup_id: matchupId,
          rosters: (grouped.get(matchupId) ?? []).sort(
            (a, b) => Number(a.roster_id) - Number(b.roster_id),
          ),
        })),
      });
    } catch (err) {
      return LiveSleeper.#fail(err);
    }
  }

  static async liveStandings(input: unknown): Promise<ToolResult> {
    const parsed = LiveSleeper.#parse(LiveSleeper.standingsInput, input);
    if (!parsed.ok) return parsed.result;

    try {
      const leagueId = parsed.data.league_id;
      const [users, rosters] = await Promise.all([
        LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/league/${leagueId}/users`),
        LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/league/${leagueId}/rosters`),
      ]);
      const owners = LiveSleeper.#owners(users, rosters);
      const rows = owners.rosterIds.map((rosterId) => {
        const roster = owners.rosterById.get(rosterId);
        const settings = roster?.settings ?? {};
        const owner = owners.byRoster.get(rosterId);
        return {
          roster_id: rosterId,
          user_id: owner?.user_id ?? null,
          display_name: owner?.display_name ?? null,
          team_name: owner?.team_name ?? null,
          wins: settings.wins ?? 0,
          losses: settings.losses ?? 0,
          ties: settings.ties ?? 0,
          points_for: LiveSleeper.#points(settings.fpts, settings.fpts_decimal),
          points_against: LiveSleeper.#points(settings.fpts_against, settings.fpts_against_decimal),
        };
      });

      rows.sort(
        (a, b) => b.wins - a.wins || b.points_for - a.points_for || a.roster_id - b.roster_id,
      );

      return LiveSleeper.#ok({
        league_id: leagueId,
        standings: rows.map((row, index) => ({ rank: index + 1, ...row })),
      });
    } catch (err) {
      return LiveSleeper.#fail(err);
    }
  }

  static #parse<T>(
    schema: z.ZodType<T>,
    input: unknown,
  ): { ok: true; data: T } | { ok: false; result: ToolResult } {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, result: LiveSleeper.#error("league_id is required") };
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      return { ok: false, result: LiveSleeper.#error(message) };
    }
    return { ok: true, data: parsed.data };
  }

  static async #loadState(): Promise<NflState> {
    const data = await LiveSleeper.#fetchJson(`${LiveSleeper.baseUrl}/state/nfl`);
    const parsed = z
      .object({
        season: z.union([z.string().min(1), z.number()]),
        week: z.number().int().nullable(),
        season_type: z.string().min(1),
      })
      .passthrough()
      .safeParse(data);
    if (!parsed.success) {
      throw new Error("Sleeper NFL state was missing season, week, or season_type");
    }
    return {
      season: String(parsed.data.season),
      week: parsed.data.week,
      season_type: parsed.data.season_type,
    };
  }

  static async #fetchJson(url: string): Promise<unknown> {
    const cached = LiveSleeperCache.get(url);
    if (cached !== undefined) return cached;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(LiveSleeper.timeoutMs),
      });
    } catch (err) {
      if (LiveSleeper.#isTimeout(err)) throw new Error("Sleeper request timed out");
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Sleeper request failed: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Sleeper request failed (${response.status})`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error("Sleeper returned invalid JSON");
    }
    LiveSleeperCache.set(url, data);
    return data;
  }

  static #isTimeout(err: unknown): boolean {
    if (!err || typeof err !== "object" || !("name" in err)) return false;
    const name = String(err.name);
    return name === "TimeoutError" || name === "AbortError";
  }

  static #points(whole?: number, decimal?: number): number {
    return (whole ?? 0) + (decimal ?? 0) / 100;
  }

  static #matchupRows(payload: unknown): Array<{
    matchup_id: number | null;
    roster_id: number;
    points: number | null;
    starters: string[];
    starters_points: Array<number | null>;
  }> {
    const parsed = z
      .array(
        z
          .object({
            matchup_id: z.number().int().nullable().optional(),
            roster_id: z.number().int(),
            points: z.number().nullable().optional(),
            starters: z.array(z.union([z.string(), z.number()])).nullable().optional(),
            starters_points: z.array(z.number().nullable()).nullable().optional(),
          })
          .passthrough(),
      )
      .safeParse(payload);
    if (!parsed.success) throw new Error("Sleeper matchups payload was not a list");
    return parsed.data.map((row) => ({
      matchup_id: row.matchup_id ?? null,
      roster_id: row.roster_id,
      points: row.points ?? null,
      starters: (row.starters ?? []).map(String),
      starters_points: row.starters_points ?? [],
    }));
  }

  static #owners(usersPayload: unknown, rostersPayload: unknown): {
    byRoster: Map<number, OwnerFields>;
    rosterById: Map<number, { owner_id: string | null; settings: RosterSettings }>;
    rosterIds: number[];
  } {
    const usersParsed = z
      .array(
        z
          .object({
            user_id: z.string(),
            display_name: z.string().nullable().optional(),
            metadata: z
              .object({ team_name: z.string().nullable().optional() })
              .nullable()
              .optional(),
          })
          .passthrough(),
      )
      .safeParse(usersPayload);
    if (!usersParsed.success) throw new Error("Sleeper users payload was not a list");

    const rostersParsed = z
      .array(
        z
          .object({
            roster_id: z.number().int(),
            owner_id: z.string().nullable().optional(),
            settings: z
              .object({
                wins: z.number().optional(),
                losses: z.number().optional(),
                ties: z.number().optional(),
                fpts: z.number().optional(),
                fpts_decimal: z.number().optional(),
                fpts_against: z.number().optional(),
                fpts_against_decimal: z.number().optional(),
              })
              .nullable()
              .optional(),
          })
          .passthrough(),
      )
      .safeParse(rostersPayload);
    if (!rostersParsed.success) throw new Error("Sleeper rosters payload was not a list");

    const usersById = new Map(usersParsed.data.map((user) => [user.user_id, user]));
    const rosterById = new Map<number, { owner_id: string | null; settings: RosterSettings }>();
    const byRoster = new Map<number, OwnerFields>();
    for (const roster of rostersParsed.data) {
      const ownerId = roster.owner_id ?? null;
      const user = ownerId ? usersById.get(ownerId) : undefined;
      rosterById.set(roster.roster_id, {
        owner_id: ownerId,
        settings: roster.settings ?? {},
      });
      byRoster.set(roster.roster_id, {
        user_id: ownerId,
        display_name: user?.display_name ?? null,
        team_name: user?.metadata?.team_name ?? null,
      });
    }

    return {
      byRoster,
      rosterById,
      rosterIds: rostersParsed.data.map((roster) => roster.roster_id),
    };
  }

  static #ok(data: unknown): ToolResult {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  static #error(message: string): ToolResult {
    return { content: [{ type: "text", text: message }], isError: true };
  }

  static #fail(err: unknown): ToolResult {
    const message = err instanceof Error ? err.message : String(err);
    return LiveSleeper.#error(message);
  }
}

type RosterSettings = {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
};
