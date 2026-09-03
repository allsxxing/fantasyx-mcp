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
import { getRedis } from "@/lib/redis";

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

const REDIS_KEY_PREFIX = "fantasyx:refresh_token:";
const LOCK_KEY_PREFIX = "fantasyx:refresh_lock:";
const LOCK_TTL_MS = 10_000;
const LOCK_WAIT_MS = 300;
const LOCK_MAX_WAITS = 15;

/**
 * Current refresh token for this upstream. Some issuers (FantasyPros, confirmed empirically)
 * rotate the refresh token on every redemption — the value returned by the token endpoint
 * invalidates the one that was just spent. Vercel functions are stateless across cold starts
 * and can run multiple instances concurrently, so the source of truth for "the current refresh
 * token" cannot live only in a build-time env var. Redis holds the live value; the env var is
 * only the initial seed from oauth-bootstrap.mjs.
 */
async function getStoredRefreshToken(config: UpstreamConfig): Promise<string | null> {
  const redis = getRedis();
  const envToken = process.env[config.refreshTokenEnv] ?? null;
  if (!redis) return envToken;
  const stored = await redis.get<string>(REDIS_KEY_PREFIX + config.name);
  return stored ?? envToken;
}

async function storeRefreshToken(config: UpstreamConfig, refreshToken: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(REDIS_KEY_PREFIX + config.name, refreshToken);
}

/** Best-effort mutual exclusion around a refresh so concurrent invocations don't race to spend
 * the same (possibly single-use) refresh token. Degrades to no locking when Redis isn't configured. */
async function withRefreshLock<T>(config: UpstreamConfig, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) return fn();

  const lockKey = LOCK_KEY_PREFIX + config.name;
  for (let attempt = 0; attempt < LOCK_MAX_WAITS; attempt++) {
    const acquired = await redis.set(lockKey, "1", { nx: true, px: LOCK_TTL_MS });
    if (acquired === "OK") {
      try {
        return await fn();
      } finally {
        await redis.del(lockKey);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_MS));
  }
  // Lock never freed (e.g. a prior holder crashed past its TTL) — proceed anyway rather than
  // hang the request; a lost race here just means one wasted refresh call, not data loss.
  return fn();
}

async function fetchAccessToken(config: UpstreamConfig): Promise<string> {
  const clientId = process.env[config.clientIdEnv];
  const refreshToken = await getStoredRefreshToken(config);
  if (!clientId || !refreshToken) {
    throw new Error(
      `${config.name} connector: ${config.clientIdEnv} / ${config.refreshTokenEnv} not configured`,
    );
  }

  return withRefreshLock(config, async () => {
    // Re-read inside the lock: another instance may have already rotated the token while we waited.
    const currentRefreshToken = (await getStoredRefreshToken(config)) ?? refreshToken;
    const res = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: currentRefreshToken,
        client_id: clientId,
      }),
    });
    if (!res.ok) {
      throw new Error(`${config.name} token refresh failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as TokenResponse;
    if (data.refresh_token && data.refresh_token !== currentRefreshToken) {
      await storeRefreshToken(config, data.refresh_token);
    }
    return data.access_token;
  });
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
