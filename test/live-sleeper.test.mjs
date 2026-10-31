import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { LiveGate, LiveSleeper, LiveSleeperCache } from "../src/tools/live-sleeper.ts";

const STATE_URL = "https://api.sleeper.app/v1/state/nfl";
const LEAGUE = "1370188155843526656";

let originalFetch;

beforeEach(() => {
  LiveSleeperCache.clear();
  LiveSleeper.timeoutMs = 10_000;
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  LiveSleeper.timeoutMs = 10_000;
  LiveSleeperCache.clear();
});

function blockFetch() {
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called");
  };
}

function textOf(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return result.content[0].text;
}

function jsonOf(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(textOf(result));
}

test("cache misses, hits inside 60s, and expires at the TTL boundary", () => {
  const url = "https://api.sleeper.app/v1/state/nfl";
  assert.equal(LiveSleeperCache.ttlMs, 60_000);
  assert.equal(LiveSleeperCache.get(url, 1_000), undefined);

  LiveSleeperCache.set(url, { week: 8 }, 1_000);
  assert.deepEqual(LiveSleeperCache.get(url, 1_000 + 59_999), { week: 8 });
  assert.equal(LiveSleeperCache.get(url, 1_000 + 60_000), undefined);
});

test("cache keys are the full URL and can store null", () => {
  LiveSleeperCache.set("https://api.sleeper.app/v1/a", { n: 1 }, 5_000);
  LiveSleeperCache.set("https://api.sleeper.app/v1/b", null, 5_000);
  assert.deepEqual(LiveSleeperCache.get("https://api.sleeper.app/v1/a", 5_000), { n: 1 });
  assert.equal(LiveSleeperCache.get("https://api.sleeper.app/v1/b", 5_000), null);
  assert.equal(LiveSleeperCache.get("https://api.sleeper.app/v1/a?x=1", 5_000), undefined);
});

test("nfl_state returns season, week, and season_type and uses the cache", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(String(url), STATE_URL);
    return Response.json({
      week: 8,
      season: "2026",
      season_type: "regular",
      leg: 8,
      display_week: 9,
    });
  };

  const first = jsonOf(await LiveSleeper.nflState());
  const second = jsonOf(await LiveSleeper.nflState());
  assert.deepEqual(first, { season: "2026", week: 8, season_type: "regular" });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test("nfl_state refetches once the cached entry is older than 60s", async () => {
  LiveSleeperCache.set(STATE_URL, { season: "2025", week: 1, season_type: "post" }, 1_000);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ season: "2026", week: 8, season_type: "regular" });
  };
  const body = jsonOf(await LiveSleeper.nflState());
  assert.equal(calls, 1);
  assert.equal(body.season, "2026");
});

test("nfl_state treats a cached null as a hit and does not refetch", async () => {
  LiveSleeperCache.set(STATE_URL, null);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ season: "2026", week: 8, season_type: "regular" });
  };
  const result = await LiveSleeper.nflState();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /season, week, or season_type/);
  assert.equal(calls, 0);
});

test("nfl_state reports HTTP errors and does not cache them", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("nope", { status: 503, statusText: "Service Unavailable" });
  };
  const first = await LiveSleeper.nflState();
  const second = await LiveSleeper.nflState();
  assert.equal(first.isError, true);
  assert.match(textOf(first), /Sleeper request failed \(503\)/);
  assert.equal(second.isError, true);
  assert.equal(calls, 2);
});

test("nfl_state reports invalid JSON", async () => {
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  const result = await LiveSleeper.nflState();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /invalid JSON/);
});

test("nfl_state reports timeouts", async () => {
  LiveSleeper.timeoutMs = 20;
  // AbortSignal.timeout does not ref the event loop; hold it open until abort fires.
  const keepAlive = setInterval(() => {}, 10);
  try {
    globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        assert.ok(init?.signal instanceof AbortSignal);
        init.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
        });
      });
    const result = await LiveSleeper.nflState();
    assert.equal(result.isError, true);
    assert.match(textOf(result), /timed out/);
  } finally {
    clearInterval(keepAlive);
  }
});

test("nfl_state reports network failures", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const result = await LiveSleeper.nflState();
  assert.equal(result.isError, true);
  assert.match(textOf(result), /Sleeper request failed: fetch failed/);
});

test("live_matchups and live_standings reject invalid input before fetching", async () => {
  blockFetch();
  const cases = [
    [() => LiveSleeper.liveMatchups(undefined), /league_id is required/],
    [() => LiveSleeper.liveMatchups({}), /league_id is required/],
    [() => LiveSleeper.liveMatchups({ league_id: 12 }), /league_id is required/],
    [() => LiveSleeper.liveMatchups({ league_id: "abc" }), /numeric Sleeper league id/],
    [() => LiveSleeper.liveMatchups({ league_id: "1/users" }), /numeric Sleeper league id/],
    [() => LiveSleeper.liveMatchups({ league_id: LEAGUE, week: 0 }), /week must be an integer from 1 to 18/],
    [() => LiveSleeper.liveMatchups({ league_id: LEAGUE, week: 19 }), /week must be an integer from 1 to 18/],
    [() => LiveSleeper.liveMatchups({ league_id: LEAGUE, week: 1.5 }), /week must be an integer from 1 to 18/],
    [() => LiveSleeper.liveMatchups({ league_id: LEAGUE, week: "8" }), /week must be an integer from 1 to 18/],
    [() => LiveSleeper.liveStandings({}), /league_id is required/],
    [() => LiveSleeper.liveStandings({ league_id: "" }), /numeric Sleeper league id/],
  ];
  for (const [call, pattern] of cases) {
    const result = await call();
    assert.equal(result.isError, true, textOf(result));
    assert.match(textOf(result), pattern);
  }
});

test("live_matchups defaults the week from nfl state and joins owners", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const key = String(url);
    calls.push(key);
    if (key.endsWith("/state/nfl")) {
      return Response.json({ season: "2026", week: 8, season_type: "regular" });
    }
    if (key.endsWith(`/league/${LEAGUE}/matchups/8`)) {
      return Response.json([
        {
          matchup_id: 2,
          roster_id: 3,
          points: 10,
          starters: ["10"],
          starters_points: [10],
        },
        {
          matchup_id: 1,
          roster_id: 2,
          points: 98,
          starters: ["2", "0"],
          starters_points: [14, 0],
        },
        {
          matchup_id: 1,
          roster_id: 1,
          points: 110.5,
          starters: ["1"],
          starters_points: [20.5],
        },
      ]);
    }
    if (key.endsWith(`/league/${LEAGUE}/users`)) {
      return Response.json([
        { user_id: "u1", display_name: "AJk12", metadata: { team_name: "Stuck Burrow" } },
        { user_id: "u2", display_name: "flamezdawson", metadata: { team_name: "Fire" } },
      ]);
    }
    if (key.endsWith(`/league/${LEAGUE}/rosters`)) {
      return Response.json([
        { roster_id: 1, owner_id: "u1" },
        { roster_id: 2, owner_id: "u2" },
        { roster_id: 3, owner_id: null },
      ]);
    }
    throw new Error(`unexpected ${key}`);
  };

  const body = jsonOf(await LiveSleeper.liveMatchups({ league_id: LEAGUE }));
  assert.equal(body.league_id, LEAGUE);
  assert.equal(body.week, 8);
  assert.equal(body.season, "2026");
  assert.equal(body.season_type, "regular");
  assert.deepEqual(
    body.matchups.map((m) => m.matchup_id),
    [1, 2],
  );
  assert.deepEqual(body.matchups[0].rosters, [
    {
      roster_id: 1,
      user_id: "u1",
      display_name: "AJk12",
      team_name: "Stuck Burrow",
      points: 110.5,
      starters: ["1"],
      starters_points: [20.5],
    },
    {
      roster_id: 2,
      user_id: "u2",
      display_name: "flamezdawson",
      team_name: "Fire",
      points: 98,
      starters: ["2", "0"],
      starters_points: [14, 0],
    },
  ]);
  assert.deepEqual(body.matchups[1].rosters[0], {
    roster_id: 3,
    user_id: null,
    display_name: null,
    team_name: null,
    points: 10,
    starters: ["10"],
    starters_points: [10],
  });
  assert.ok(calls.some((url) => url.endsWith("/matchups/8")));

  calls.length = 0;
  await LiveSleeper.liveMatchups({ league_id: LEAGUE });
  assert.deepEqual(calls, []);
});

test("live_matchups uses an explicit week and does not require nfl state", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const key = String(url);
    calls.push(key);
    if (key.endsWith(`/league/${LEAGUE}/matchups/3`)) return Response.json([]);
    if (key.endsWith(`/league/${LEAGUE}/users`)) return Response.json([]);
    if (key.endsWith(`/league/${LEAGUE}/rosters`)) return Response.json([]);
    throw new Error(`unexpected ${key}`);
  };
  const body = jsonOf(await LiveSleeper.liveMatchups({ league_id: LEAGUE, week: 3 }));
  assert.equal(body.week, 3);
  assert.equal(body.season, null);
  assert.equal(body.season_type, null);
  assert.deepEqual(body.matchups, []);
  assert.equal(calls.some((url) => url.endsWith("/state/nfl")), false);
});

test("live_matchups errors when the current week is missing", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/state/nfl")) {
      return Response.json({ season: "2026", week: null, season_type: "off" });
    }
    throw new Error(`unexpected ${url}`);
  };
  const result = await LiveSleeper.liveMatchups({ league_id: LEAGUE });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /pass week explicitly/);
});

test("live_standings sorts wins then points for and combines Sleeper decimals", async () => {
  globalThis.fetch = async (url) => {
    const key = String(url);
    if (key.endsWith(`/league/${LEAGUE}/users`)) {
      return Response.json([
        { user_id: "u2", display_name: "flamezdawson", metadata: { team_name: "Fire" } },
        { user_id: "u9", display_name: "Nels8951", metadata: {} },
        { user_id: "u1", display_name: "AJk12", metadata: { team_name: "Stuck Burrow" } },
      ]);
    }
    if (key.endsWith(`/league/${LEAGUE}/rosters`)) {
      return Response.json([
        {
          roster_id: 4,
          owner_id: null,
          settings: { wins: 3, losses: 5, ties: 0, fpts: 500, fpts_decimal: 0, fpts_against: 600, fpts_against_decimal: 50 },
        },
        {
          roster_id: 9,
          owner_id: "u9",
          settings: { wins: 5, losses: 3, ties: 0, fpts: 100, fpts_decimal: 50, fpts_against: 90, fpts_against_decimal: 0 },
        },
        {
          roster_id: 2,
          owner_id: "u2",
          settings: { wins: 5, losses: 2, ties: 1, fpts: 100, fpts_decimal: 50, fpts_against: 80, fpts_against_decimal: 25 },
        },
        {
          roster_id: 1,
          owner_id: "u1",
          settings: { wins: 5, losses: 3, ties: 0, fpts: 1114, fpts_decimal: 10, fpts_against: 873, fpts_against_decimal: 90 },
        },
      ]);
    }
    throw new Error(`unexpected ${key}`);
  };

  const body = jsonOf(await LiveSleeper.liveStandings({ league_id: LEAGUE }));
  assert.equal(body.league_id, LEAGUE);
  assert.deepEqual(
    body.standings.map((row) => [row.rank, row.roster_id, row.wins, row.points_for]),
    [
      [1, 1, 5, 1114.1],
      [2, 2, 5, 100.5],
      [3, 9, 5, 100.5],
      [4, 4, 3, 500],
    ],
  );
  assert.equal(body.standings[0].display_name, "AJk12");
  assert.equal(body.standings[0].team_name, "Stuck Burrow");
  assert.equal(body.standings[0].points_against, 873.9);
  assert.equal(body.standings[0].losses, 3);
  assert.equal(body.standings[0].ties, 0);
  assert.equal(body.standings[1].ties, 1);
  assert.equal(body.standings[1].points_against, 80.25);
  assert.equal(body.standings[2].team_name, null);
  assert.equal(body.standings[3].display_name, null);
  assert.equal(body.standings[3].user_id, null);
});

function gateRequest(authorization) {
  const headers = authorization ? { authorization } : undefined;
  return new Request("http://127.0.0.1/api/live/mcp", { method: "POST", headers });
}

test("LiveGate returns 404 unless FANTASYX_LIVE is exactly 1", () => {
  for (const live of [undefined, "", "0", "true", "yes"]) {
    const env = { FANTASYX_LIVE: live, FANTASYX_LIVE_TOKEN: "sekret" };
    const res = LiveGate.deny(gateRequest("Bearer sekret"), env);
    assert.equal(res?.status, 404, `flag ${String(live)}`);
  }
  assert.equal(LiveGate.deny(gateRequest("Bearer sekret"), { FANTASYX_LIVE: "1", FANTASYX_LIVE_TOKEN: "sekret" }), null);
});

test("LiveGate returns 401 for a missing, blank, or wrong bearer token", () => {
  const env = { FANTASYX_LIVE: "1", FANTASYX_LIVE_TOKEN: "sekret" };
  for (const header of [undefined, "sekret", "Bearer", "Bearer wrong", "Bearer sekret-extra", "Token sekret"]) {
    const res = LiveGate.deny(gateRequest(header), env);
    assert.equal(res?.status, 401, `header ${String(header)}`);
    assert.match(res.headers.get("www-authenticate") ?? "", /Bearer/);
  }
  const blank = LiveGate.deny(gateRequest("Bearer sekret"), { FANTASYX_LIVE: "1", FANTASYX_LIVE_TOKEN: "   " });
  assert.equal(blank?.status, 401);
  const missing = LiveGate.deny(gateRequest("Bearer sekret"), { FANTASYX_LIVE: "1" });
  assert.equal(missing?.status, 401);
  assert.equal(
    LiveGate.deny(gateRequest("bearer sekret"), env),
    null,
  );
});

function probe(scenario, env) {
  const base = { ...process.env, NODE_ENV: "production" };
  delete base.FANTASYX_LIVE;
  delete base.FANTASYX_LIVE_TOKEN;
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", path.join(import.meta.dirname, "live-route-probe.mjs"), scenario],
      { env: { ...base, ...env } },
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`probe ${scenario} timed out\n${out}\n${err}`));
    }, 8_000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`probe ${scenario} exit ${code}\n${out}\n${err}`));
      else resolve(out);
    });
  });
}

test("live route returns 404 when the flag is off", async () => {
  const off = await probe("off", { FANTASYX_LIVE_TOKEN: "live-test-token" });
  assert.match(off, /^STATUS 404\b/m);
  const head = await probe("head-off", {});
  assert.match(head, /^STATUS 404\b/m);
  const get = await probe("get-off", {});
  assert.match(get, /^STATUS 404\b/m);
});

test("live route returns 401 without a matching bearer token", async () => {
  const on = { FANTASYX_LIVE: "1", FANTASYX_LIVE_TOKEN: "live-test-token" };
  assert.match(await probe("no-token", on), /^STATUS 401\b/m);
  assert.match(await probe("bad-token", on), /^STATUS 401\b/m);
  assert.match(await probe("empty-token-env", { FANTASYX_LIVE: "1" }), /^STATUS 401\b/m);
});

test("live route lists only the three live tools when the flag and token match", async () => {
  const out = await probe("tools-list", { FANTASYX_LIVE: "1", FANTASYX_LIVE_TOKEN: "live-test-token" });
  assert.match(out, /^STATUS 200\b/m);
  assert.match(out, /nfl_state/);
  assert.match(out, /live_matchups/);
  assert.match(out, /live_standings/);
  assert.doesNotMatch(out, /fx_get_rules/);
  assert.doesNotMatch(out, /fx_get_standings/);
});
