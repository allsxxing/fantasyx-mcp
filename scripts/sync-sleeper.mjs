#!/usr/bin/env node
// sync-sleeper.mjs — pulls live league state from the OFFICIAL Sleeper API
// (https://docs.sleeper.com, base https://api.sleeper.app/v1). Public, unauthenticated,
// no credentials, 1000 req/min.
//
// Walks the season chain back from the 2026 league via previous_league_id, resolving
// each season's champion, roster membership and draft, and writes content/seasons/<year>.json
// plus content/managers.json. For the newest (upcoming) season it diffs membership against the
// prior season to derive departures / additions / open spots — no hardcoded roster changes.
//
// Everything this script writes is GENERATED. Never hand-edit content/seasons/*.json or
// content/managers.json — edit nothing, re-run this instead. Draft order in particular is
// resolved from /v1/draft and is null until Sleeper randomizes it; do NOT transcribe an order
// off a screenshot, and do NOT invent one.
//
// Does NOT fetch /players/nfl — that ~5MB map is a build-time concern (build-content.mjs),
// trimmed to {player_id, full_name, position, team} and never runtime-cached.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(__dirname, '..', 'content');
const SEASONS = join(CONTENT, 'seasons');

const API = 'https://api.sleeper.app/v1';
const START_LEAGUE = process.env.FANTASYX_LEAGUE_2026 || '1370188155843526656';

const log = (...a) => console.log('[sync]', ...a);
const warn = (...a) => console.warn('[sync] WARN', ...a);

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

const STATUS_MAP = { pre_draft: 'upcoming', drafting: 'upcoming', in_season: 'in_season', complete: 'complete' };

async function fetchBundle(leagueId) {
  const [league, users, rosters] = await Promise.all([
    getJson(`/league/${leagueId}`),
    getJson(`/league/${leagueId}/users`),
    getJson(`/league/${leagueId}/rosters`),
  ]);
  let winnersBracket = null;
  try { winnersBracket = await getJson(`/league/${leagueId}/winners_bracket`); } catch { /* not available pre-playoffs */ }
  // A league that references a draft MUST return one. Swallowing this error would let a
  // transient Sleeper failure be written as draft_order: null — schema-valid, and therefore
  // committed by CI as a deletion of a real draft order. Fail loudly and keep the last good data.
  let draft = null;
  if (league.draft_id) {
    try {
      draft = await getJson(`/draft/${league.draft_id}`);
    } catch (err) {
      throw new Error(`draft ${league.draft_id} unavailable; refusing to write incomplete draft data: ${err.message}`);
    }
  }
  return { league, users, rosters, winnersBracket, draft };
}

function membersOf({ users, rosters }) {
  const rosterByOwner = new Map(rosters.map(r => [r.owner_id, r.roster_id]));
  return users.map(u => ({
    user_id: u.user_id,
    display_name: u.display_name,
    team_name: u.metadata?.team_name ?? null,
    roster_id: rosterByOwner.get(u.user_id) ?? null,
  })).sort((a, b) => (a.roster_id ?? 99) - (b.roster_id ?? 99));
}

function resolveChampion({ league, users, rosters, winnersBracket }) {
  let rosterId = league.metadata?.latest_league_winner_roster_id
    ? Number(league.metadata.latest_league_winner_roster_id)
    : null;
  if (!rosterId && Array.isArray(winnersBracket) && winnersBracket.length) {
    // championship match is the highest round with a winner in slot p===1
    const final = winnersBracket.filter(m => m.p === 1).sort((a, b) => b.r - a.r)[0];
    if (final?.w) rosterId = final.w;
  }
  if (!rosterId) return null;
  const roster = rosters.find(r => r.roster_id === rosterId);
  const user = roster ? users.find(u => u.user_id === roster.owner_id) : null;
  return {
    roster_id: rosterId,
    user_id: user?.user_id ?? null,
    display_name: user?.display_name ?? null,
    team_name: user?.metadata?.team_name ?? null,
    source: league.metadata?.latest_league_winner_roster_id ? 'league.metadata.latest_league_winner_roster_id' : 'winners_bracket',
  };
}

// Write only when the substantive data changed. `synced_at` / `generated_at` are rewritten on
// every run, so writing unconditionally leaves the tree permanently dirty and turns CI's
// "commit only if something changed" guard into "commit every run". Compare with the volatile
// keys stripped, and leave the file (timestamp included) untouched when nothing else moved.
const VOLATILE = ['synced_at', 'generated_at'];

async function writeIfChanged(path, obj) {
  const stable = o => JSON.stringify(o, (k, v) => (VOLATILE.includes(k) ? undefined : v));
  try {
    const existing = JSON.parse(await readFile(path, 'utf8'));
    if (stable(existing) === stable(obj)) return false;
  } catch { /* missing or unparseable — fall through and write */ }
  await writeFile(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return true;
}

function draftInfo(draft) {
  if (!draft) return null;
  return {
    draft_id: draft.draft_id,
    status: draft.status ?? null,
    type: draft.type ?? null,
    start_time: draft.start_time ?? null, // epoch ms as Sleeper returns it; formatting is a render concern
    rounds: draft.settings?.rounds ?? null,
    pick_timer_seconds: draft.settings?.pick_timer ?? null,
    source: 'sleeper /v1/draft',
  };
}

// Sleeper gives draft_order as user_id → slot and slot_to_roster_id as slot → roster_id.
// Join both against the members list. Returns null before the order is randomized — the
// absence of an order is itself the fact, and must never be filled in by hand.
function draftOrderOf(draft, members) {
  if (!draft?.draft_order) return null;
  const memberByUser = new Map(members.map(m => [m.user_id, m]));
  const rosterBySlot = draft.slot_to_roster_id ?? {};
  return Object.entries(draft.draft_order)
    .map(([userId, slot]) => {
      const m = memberByUser.get(userId);
      return {
        draft_position: Number(slot),
        roster_id: rosterBySlot[slot] ?? m?.roster_id ?? null,
        user_id: userId,
        display_name: m?.display_name ?? null,
        team_name: m?.team_name ?? null,
      };
    })
    .sort((a, b) => a.draft_position - b.draft_position);
}

async function walkChain(startId, maxDepth = 6) {
  const chain = [];
  let id = startId;
  let depth = 0;
  while (id && depth < maxDepth) {
    log('fetch league', id);
    const bundle = await fetchBundle(id);
    chain.push(bundle);
    id = bundle.league.previous_league_id;
    depth++;
  }
  return chain; // newest → oldest
}

function diffMembers(prevMembers, currMembers) {
  const prevIds = new Set(prevMembers.map(m => m.user_id));
  const currIds = new Set(currMembers.map(m => m.user_id));
  return {
    departures: prevMembers.filter(m => !currIds.has(m.user_id))
      .map(m => ({ user_id: m.user_id, display_name: m.display_name, prior_roster_id: m.roster_id, status: 'to_be_filled', note: 'In prior season, not in current roster; spot to be filled before Draft Day.' })),
    additions: currMembers.filter(m => !prevIds.has(m.user_id))
      .map(m => ({ user_id: m.user_id, display_name: m.display_name, roster_id: m.roster_id })),
  };
}

async function main() {
  await mkdir(SEASONS, { recursive: true });
  const chain = await walkChain(START_LEAGUE);
  log(`chain length: ${chain.length} season(s)`);

  const written = [];
  for (let i = 0; i < chain.length; i++) {
    const bundle = chain[i];
    const lg = bundle.league;
    const season = lg.season;
    const status = STATUS_MAP[lg.status] ?? lg.status;
    const members = membersOf(bundle);
    const champion = status === 'complete' ? resolveChampion(bundle) : null;

    const out = {
      season,
      league_id: lg.league_id,
      previous_league_id: lg.previous_league_id ?? null,
      draft_id: lg.draft_id ?? null,
      status,
      num_teams: lg.settings?.num_teams ?? null,
      member_count: members.length,
      champion,
      members,
      draft: draftInfo(bundle.draft),
      draft_order: draftOrderOf(bundle.draft, members),
      source: 'sync-sleeper.mjs — https://api.sleeper.app',
      synced_at: new Date().toISOString(),
    };

    if (bundle.draft && !out.draft_order) {
      warn(`season ${season}: draft ${bundle.draft.draft_id} has no draft_order yet (status: ${bundle.draft.status}) — writing null, NOT guessing.`);
    }

    // For the newest season, diff against the prior season to surface roster changes.
    if (i === 0 && chain[1]) {
      const prevMembers = membersOf(chain[1]);
      const { departures, additions } = diffMembers(prevMembers, members);
      out.roster_changes = {
        vs_season: chain[1].league.season,
        departures,
        additions,
        open_spots: (lg.settings?.num_teams ?? members.length) - members.length,
      };
    }

    const changed = await writeIfChanged(join(SEASONS, `${season}.json`), out);
    written.push(`${season} (${status}${champion ? `, champ: ${champion.display_name}` : ''}${changed ? '' : ', unchanged'})`);
    log(changed ? 'wrote' : 'unchanged', `seasons/${season}.json`);
  }

  await writeManagers(chain[0]);

  log('done:', written.join(' | '));
}

// content/managers.json is the flat current-season registry. It is derived from the same live
// members list as seasons/<newest>.json so the two can never disagree — that drift is exactly
// what a hand-edited registry caused before.
async function writeManagers(bundle) {
  const members = membersOf(bundle);
  let commishId = null;
  try {
    const league = JSON.parse(await readFile(join(CONTENT, 'league.json'), 'utf8'));
    commishId = league.commissioner?.user_id ?? null;
  } catch (err) {
    warn('could not read league.json for commissioner id:', err.message);
  }
  const out = {
    season: bundle.league.season,
    source_league_id: bundle.league.league_id,
    generated_at: new Date().toISOString(),
    source: 'sync-sleeper.mjs — https://api.sleeper.app',
    num_teams: bundle.league.settings?.num_teams ?? null,
    member_count: members.length,
    managers: members.map(m => ({ ...m, is_commissioner: m.user_id === commishId })),
  };
  const changed = await writeIfChanged(join(CONTENT, 'managers.json'), out);
  log(changed ? 'wrote' : 'unchanged', `managers.json (${members.length} managers)`);
}

main().catch(err => { console.error('[sync] FAILED', err); process.exit(1); });
