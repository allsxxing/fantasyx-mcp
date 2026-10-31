// OPT-IN live scores — /api/live/mcp. Dark unless FANTASYX_LIVE=1, then bearer-gated by
// FANTASYX_LIVE_TOKEN. Exposes only nfl_state, live_matchups, and live_standings.
// The public /api/mcp route is a separate module and is not affected when this flag is off.
//
// basePath must match this route's directory; mcp-handler treats the final segment ("mcp")
// as the transport name.
import { createMcpHandler } from "mcp-handler";
import { LiveGate, LiveSleeper } from "@/tools/live-sleeper";

const handler = createMcpHandler(
  (server) => {
    LiveSleeper.register(server);
  },
  {
    serverInfo: { name: "fantasyx-mcp-live", version: "0.1.0" },
    capabilities: { tools: {} },
    instructions:
      "Opt-in live Sleeper scores for 🔟 FOR $10❌. nfl_state returns the current NFL season, " +
      "week, and season_type. live_matchups and live_standings take a Sleeper league_id. " +
      "Week on live_matchups defaults to the current NFL week. These tools read the public " +
      "Sleeper API only.",
  },
  {
    basePath: "/api/live",
    maxDuration: 60,
    disableSse: true,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request): Promise<Response> {
  const denied = LiveGate.deny(request);
  if (denied) return withCors(denied);
  return withCors(await handler(request));
}

export function HEAD(request: Request): Response {
  const denied = LiveGate.deny(request);
  if (denied) return withCors(denied);
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export function OPTIONS(request: Request): Response {
  const denied = LiveGate.deny(request);
  if (denied) return withCors(denied);
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { handle as GET, handle as POST };
