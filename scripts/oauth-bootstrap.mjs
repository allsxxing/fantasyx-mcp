#!/usr/bin/env node
// One-time, LOCAL, interactive OAuth bootstrap for a personal upstream (flaim | fantasypros).
// Run this yourself in a terminal with a browser available — it is never invoked by the app or
// by CI. It performs Dynamic Client Registration + Authorization Code + PKCE against the
// upstream's own OAuth server, then prints the client_id and refresh_token to paste into Vercel
// Production env vars. NOTHING here is committed or logged to a file.
//
// Usage: node scripts/oauth-bootstrap.mjs <flaim|fantasypros>
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { execFile } from "node:child_process";

const TARGETS = {
  flaim: {
    issuer: "https://api.flaim.app",
    scopes: "mcp:read mcp:write",
  },
  fantasypros: {
    issuer: "https://secure.fantasypros.com",
    scopes: "user:read offline_access",
  },
};

const PORT = 8787;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function openBrowser(url) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(opener, [url], () => {});
}

async function main() {
  const target = process.argv[2];
  const config = TARGETS[target];
  if (!config) {
    console.error(`Usage: node scripts/oauth-bootstrap.mjs <${Object.keys(TARGETS).join("|")}>`);
    process.exit(1);
  }

  console.log(`[oauth-bootstrap] fetching AS metadata for ${config.issuer} ...`);
  const asMeta = await fetch(`${config.issuer}/.well-known/oauth-authorization-server`).then((r) =>
    r.json(),
  );

  console.log(`[oauth-bootstrap] registering a public client via DCR ...`);
  const dcrRes = await fetch(asMeta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "fantasyx-grok-gateway (personal)",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!dcrRes.ok) {
    throw new Error(`DCR failed: ${dcrRes.status} ${await dcrRes.text()}`);
  }
  const { client_id } = await dcrRes.json();
  console.log(`[oauth-bootstrap] registered client_id: ${client_id}`);

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const state = base64url(randomBytes(16));

  const authUrl = new URL(asMeta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", config.scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const returnedState = url.searchParams.get("state");
      const returnedCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/plain" });
      if (error || !returnedCode || returnedState !== state) {
        res.end("Authorization failed. You can close this tab.");
        server.close();
        reject(new Error(error ?? "state mismatch or missing code"));
        return;
      }
      res.end("Authorized. You can close this tab and return to the terminal.");
      server.close();
      resolve(returnedCode);
    });
    server.listen(PORT, () => {
      console.log(`[oauth-bootstrap] opening browser for ${target} login ...`);
      console.log(authUrl.toString());
      openBrowser(authUrl.toString());
    });
  });

  console.log(`[oauth-bootstrap] exchanging code for tokens ...`);
  const tokenRes = await fetch(asMeta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id,
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokens = await tokenRes.json();

  const idEnv = target === "flaim" ? "FLAIM_CLIENT_ID" : "FANTASYPROS_CLIENT_ID";
  const refreshEnv = target === "flaim" ? "FLAIM_REFRESH_TOKEN" : "FANTASYPROS_REFRESH_TOKEN";

  console.log("\n[oauth-bootstrap] Success. Paste these into Vercel Production env vars —");
  console.log("do NOT commit them, this script does not write them to any file:\n");
  console.log(`${idEnv}=${client_id}`);
  console.log(`${refreshEnv}=${tokens.refresh_token ?? "(no refresh_token returned — check scope includes offline access)"}`);
}

main().catch((err) => {
  console.error(`[oauth-bootstrap] failed: ${err.message}`);
  process.exit(1);
});
