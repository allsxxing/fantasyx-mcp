// Sleeper read API client. The API is public and unauthenticated (no key, 1000 req/min).
// Docs: https://docs.sleeper.com/ — we only touch league-scoped read endpoints here.
import type { FantasyConnector, Standing } from "./types";

const API = "https://api.sleeper.app/v1";

export interface SleeperUser {
  user_id: string;
  display_name: string | null;
  metadata?: { team_name?: string | null } | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  } | null;
}

// Next augments RequestInit with `next.revalidate`, but that augmentation lives in the
// Next-generated next-env.d.ts. Declare the shape locally so typechecking doesn't depend on
// whether `next dev`/`next build` has run yet.
type NextRequestInit = RequestInit & { next?: { revalidate?: number } };

async function getJson<T>(path: string): Promise<T> {
  const init: NextRequestInit = {
    headers: { accept: "application/json" },
    // Sleeper data changes slowly; let Next revalidate rather than hammering the API.
    next: { revalidate: 300 },
  };
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    throw new Error(`Sleeper API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  return getJson<SleeperUser[]>(`/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

/** Combine two integer/decimal point fields into a single number (Sleeper splits them). */
function points(whole?: number, decimal?: number): number {
  return (whole ?? 0) + (decimal ?? 0) / 100;
}

export class SleeperConnector implements FantasyConnector {
  readonly name = "sleeper";

  async getStandings(leagueId: string): Promise<Standing[]> {
    const [users, rosters] = await Promise.all([
      getLeagueUsers(leagueId),
      getLeagueRosters(leagueId),
    ]);
    const byId = new Map(users.map((u) => [u.user_id, u]));

    const rows = rosters.map((r) => {
      const owner = r.owner_id ? byId.get(r.owner_id) : undefined;
      const s = r.settings ?? {};
      return {
        roster_id: r.roster_id,
        user_id: r.owner_id ?? null,
        display_name: owner?.display_name ?? null,
        team_name: owner?.metadata?.team_name ?? null,
        wins: s.wins ?? 0,
        losses: s.losses ?? 0,
        ties: s.ties ?? 0,
        points_for: points(s.fpts, s.fpts_decimal),
        points_against: points(s.fpts_against, s.fpts_against_decimal),
        rank: 0,
      };
    });

    rows.sort((a, b) => b.wins - a.wins || b.points_for - a.points_for);
    rows.forEach((row, i) => (row.rank = i + 1));
    return rows;
  }
}

export const sleeper = new SleeperConnector();
