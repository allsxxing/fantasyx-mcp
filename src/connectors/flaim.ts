// Flaim MCP connector — STUB. Flaim is already connected as its own MCP and answers most
// league-state questions; FantasyX defers to it rather than duplicating. This stub exists so a
// future migration can point tools at Flaim through the shared interface without new call sites.
import { ConnectorNotImplementedError, type FantasyConnector, type Standing } from "./types";

export class FlaimConnector implements FantasyConnector {
  readonly name = "flaim";

  getStandings(_leagueId: string): Promise<Standing[]> {
    throw new ConnectorNotImplementedError(this.name, "getStandings");
  }
}

export const flaim = new FlaimConnector();
