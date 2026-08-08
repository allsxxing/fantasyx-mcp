// Shared connector interface. Sleeper is implemented; Flaim and LeagueLoom are stubs that
// satisfy the same shape so tools can be pointed at a different backend later without changing
// call sites. Keep this surface small — it only covers what more than one backend can answer.

export interface Standing {
  rank: number;
  roster_id: number;
  user_id: string | null;
  display_name: string | null;
  team_name: string | null;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
}

export interface FantasyConnector {
  /** Stable identifier for the backing service, e.g. "sleeper". */
  readonly name: string;
  /** League-scoped standings, ranked best-first. `leagueId` is the backend's own league id. */
  getStandings(leagueId: string): Promise<Standing[]>;
}

export class ConnectorNotImplementedError extends Error {
  constructor(connector: string, method: string) {
    super(`${connector} connector does not implement ${method}() yet`);
    this.name = "ConnectorNotImplementedError";
  }
}
