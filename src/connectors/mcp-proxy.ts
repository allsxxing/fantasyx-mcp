// Client-as-proxy connector: this server acts as an OAuth-authenticated MCP CLIENT to a personal
// upstream (Flaim, FantasyPros), then republishes its tools under our own namespace. Personal-only
// by design — the refresh token belongs to one user (the commissioner), not a multi-tenant pool.
//
// Auth model: refresh_token grant against the upstream's OAuth token endpoint. Access tokens are
// cached in module scope, which survives warm Fluid Compute invocations but not cold starts — a
// fresh token fetch on cold start is expected and cheap (one extra round trip, not a full OAuth
// dance, since DCR + user consent already happened once via scripts/oauth-bootstrap.mjs).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type UpstreamName = "flaim" | "fantasypros";

export interface UpstreamConfig {
  name: UpstreamName;
  mcpUrl: string;
  tokenEndpoint: string;
  clientIdEnv: string;
  refreshTokenEnv: string;
}

export const UPSTREAMS: Record<UpstreamName, UpstreamConfig> = {
  flaim: {
    name: "flaim",
    mcpUrl: "https://api.flaim.app/mcp",
    tokenEndpoint: "https://api.flaim.app/auth/token",
    clientIdEnv: "FLAIM_CLIENT_ID",
    refreshTokenEnv: "FLAIM_REFRESH_TOKEN",
  },
  fantasypros: {
    name: "fantasypros",
    mcpUrl: "https://api.fantasypros.com/mcp",
    tokenEndpoint: "https://secure.fantasypros.com/oauth/token/",
    clientIdEnv: "FANTASYPROS_CLIENT_ID",
    refreshTokenEnv: "FANTASYPROS_REFRESH_TOKEN",
  },
};

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<UpstreamName, CachedToken>();
const EXPIRY_MARGIN_MS = 30_000;

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

/**
 * Exchange the configured refresh token for a short-lived access token. Does not persist a
 * rotated refresh token — see the plan's Stage 1 note: if the upstream rotates refresh tokens,
 * this must move to a KV-backed store before it's relied on beyond a single deploy's lifetime.
 */
async function fetchAccessToken(config: UpstreamConfig): Promise<string> {
  const clientId = process.env[config.clientIdEnv];
  const refreshToken = process.env[config.refreshTokenEnv];
  if (!clientId || !refreshToken) {
    throw new Error(
      `${config.name} connector: ${config.clientIdEnv} / ${config.refreshTokenEnv} not configured`,
    );
  }

  const res = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) {
    throw new Error(`${config.name} token refresh failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

async function getAccessToken(config: UpstreamConfig): Promise<string> {
  const cached = tokenCache.get(config.name);
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cached.accessToken;
  }
  const accessToken = await fetchAccessToken(config);
  // No expires_in from the upstream response is treated as a short-lived token, not eternal.
  tokenCache.set(config.name, { accessToken, expiresAt: Date.now() + 5 * 60_000 });
  return accessToken;
}

const CALL_TIMEOUT_MS = 20_000;

/** Open a fresh authenticated client for one call. Vercel is stateless; no connection reuse. */
export async function withUpstreamClient<T>(
  upstream: UpstreamName,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const config = UPSTREAMS[upstream];
  const accessToken = await getAccessToken(config);
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: "fantasyx-grok-gateway", version: "0.1.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

/** Call one upstream tool by name and return its raw result content array. */
export async function callUpstreamTool(
  upstream: UpstreamName,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withUpstreamClient(upstream, async (client) => {
    const result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: CALL_TIMEOUT_MS },
    );
    return result;
  });
}

export async function listUpstreamTools(upstream: UpstreamName): Promise<unknown> {
  return withUpstreamClient(upstream, async (client) => client.listTools());
}
