// Child process so importing the live MCP route (mcp-handler starts an interval)
// cannot hang the test runner. Prints STATUS and, when present, the first body chunk.
import { registerHooks } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const srcRoot = path.resolve(import.meta.dirname, "../src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const file = [`${rel}.ts`, `${rel}.tsx`, `${rel}.mts`, rel]
        .map((suffix) => path.join(srcRoot, suffix))
        .find((candidate) => existsSync(candidate));
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const scenario = process.argv[2];
const token = "live-test-token";

const { GET, POST, HEAD } = await import("../src/app/api/live/mcp/route.ts");

function request(method, { auth, body } = {}) {
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  if (auth) headers.authorization = auth;
  return new Request("http://127.0.0.1/api/live/mcp", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const scenarios = {
  async off() {
    return POST(request("POST", { auth: `Bearer ${token}`, body: {} }));
  },
  async "no-token"() {
    return POST(request("POST", { body: {} }));
  },
  async "bad-token"() {
    return POST(request("POST", { auth: "Bearer not-the-token", body: {} }));
  },
  async "empty-token-env"() {
    return POST(request("POST", { auth: "Bearer something", body: {} }));
  },
  async "head-off"() {
    return HEAD(request("HEAD"));
  },
  async "get-off"() {
    return GET(request("GET"));
  },
  async "tools-list"() {
    return POST(
      request("POST", {
        auth: `Bearer ${token}`,
        body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      }),
    );
  },
};

const run = scenarios[scenario];
if (!run) {
  console.error(`unknown scenario ${scenario}`);
  process.exit(2);
}

try {
  const res = await run();
  console.log(`STATUS ${res.status}`);
  if (res.body) {
    const reader = res.body.getReader();
    const first = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve({ value: undefined }), 4000)),
    ]);
    if (first?.value) process.stdout.write(`BODY ${Buffer.from(first.value).toString("utf8")}\n`);
    await reader.cancel().catch(() => {});
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}

process.exit(0);
