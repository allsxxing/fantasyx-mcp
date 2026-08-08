// LeagueLoom MCP connector — STUB. Reserved as a future backend; implements the shared
// interface so it can be swapped in without touching tool code.
import { ConnectorNotImplementedError, type FantasyConnector, type Standing } from "./types";

export class LeagueLoomConnector implements FantasyConnector {
  readonly name = "leagueloom";

  getStandings(_leagueId: string): Promise<Standing[]> {
    throw new ConnectorNotImplementedError(this.name, "getStandings");
  }
}

export const leagueloom = new LeagueLoomConnector();
