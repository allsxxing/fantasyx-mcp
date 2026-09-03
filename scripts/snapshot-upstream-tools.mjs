#!/usr/bin/env node
// Snapshots each upstream's tools/list into content/upstream-tools/<name>.json at build time, so
// a schema change shows up as a reviewable git diff instead of a silent runtime behavior change.
// Non-fatal by design: an upstream outage or missing credentials must not break `next build` —
// it leaves the last-committed snapshot in place and warns.
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "content", "upstream-tools");

const UPSTREAMS = [
  {
    name: "flaim",
    mcpUrl: "https://api.flaim.app/mcp",
    tokenEndpoint: "https://api.flaim.app/auth/token",
    clientIdEnv: "FLAIM_CLIENT_ID",
    refreshTokenEnv: "FLAIM_REFRESH_TOKEN",
  },
  {
    name: "fantasypros",
    mcpUrl: "https://api.fantasypros.com/mcp",
    tokenEndpoint: "https://secure.fantasypros.com/oauth/token/",
    clientIdEnv: "FANTASYPROS_CLIENT_ID",
    refreshTokenEnv: "FANTASYPROS_REFRESH_TOKEN",
  },
];

async function getAccessToken(upstream) {
  const clientId = process.env[upstream.clientIdEnv];
  const refreshToken = process.env[upstream.refreshTokenEnv];
  if (!clientId || !refreshToken) return null;
  const res = await fetch(upstream.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function snapshotOne(upstream) {
  const outPath = path.join(OUT_DIR, `${upstream.name}.json`);
  const accessToken = await getAccessToken(upstream);
  if (!accessToken) {
    console.warn(
      `[snapshot-upstream-tools] ${upstream.name}: no credentials configured, skipping ` +
        `(existing snapshot at ${outPath} left untouched if present)`,
    );
    return;
  }

  try {
    const res = await fetch(upstream.mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const text = await res.text();
    // Response may be plain JSON or an SSE "event: message\ndata: {...}" frame.
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    const jsonText = dataLine ? dataLine.slice("data:".length).trim() : text;
    const parsed = JSON.parse(jsonText);
    if (parsed.error) throw new Error(parsed.error.message ?? "unknown JSON-RPC error");

    const tools = parsed.result?.tools ?? [];
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(outPath, JSON.stringify({ upstream: upstream.name, tools }, null, 2) + "\n");
    console.log(`[snapshot-upstream-tools] ${upstream.name}: wrote ${tools.length} tool(s)`);
  } catch (err) {
    console.warn(
      `[snapshot-upstream-tools] ${upstream.name}: fetch failed (${err.message}), ` +
        `leaving existing snapshot in place`,
    );
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  await Promise.all(UPSTREAMS.map(snapshotOne));
}

main();
