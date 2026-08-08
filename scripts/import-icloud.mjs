#!/usr/bin/env node
// import-icloud.mjs — one-time / re-runnable importer.
//
// Reads the league's source corpus from iCloud and emits the *derivable* content
// files (league.json, managers.json, scoring.md, rules.md, rules.meta.json, and the
// archived superseded rules). Hand-authored files (voice, chat-templates,
// commissioner docs, x-champion-log, dues, links, seasons) are NOT touched here.
//
// This is also the RULES RE-SYNC path. The V4 rules are a provisional working
// guideline, still subject to change as the season approaches. To update them:
//   1. Edit the source doc (Google Doc / iCloud .md).
//   2. Run:  node scripts/import-icloud.mjs
//   3. Review the diff and commit.
// rules.meta.json records the version/status so downstream tools can flag them as
// provisional rather than final.
//
// Live Sleeper state (rosters, standings, season chain) is NOT imported here — that
// is sync-sleeper.mjs, which uses the official public API at https://api.sleeper.app.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const CONTENT = join(REPO, 'content');

// Source corpus root — override with FANTASYX_CORPUS if it moves.
const CORPUS = process.env.FANTASYX_CORPUS ||
  join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', '🎰PICK$!', '🏆FANTASY!');
const HISTORY_2025 = join(CORPUS, '🗓️LeagueHistory', '2025_LeagueHistory');

const SRC = {
  rulesV4:        join(CORPUS, '10_FOR_10X_League_Rules_2026-08-08.md'),
  rulesSuperseded: join(CORPUS, '10_FOR_10X_LEAGUE_RULES_2026 (1).md'),
  league2025:     join(HISTORY_2025, '10For10_2025-1214028632419217409.json'),
  users2025:      join(HISTORY_2025, '10For10_2025-SleeperAPI-users.json'),
  rosters2025:    join(HISTORY_2025, '10For10_2025-SleeperAPI-rosters.json'),
};

const RULES_META = {
  version: 'V4',
  status: 'work_in_progress',
  locked: false,
  last_updated: '2026-08-08',
  source_file: '10_FOR_10X_League_Rules_2026-08-08.md',
  source_doc_url: 'https://docs.google.com/document/d/1CbuFAKtUaUjPJO-zElmR9QaJ_FF7QwKrHRnnNAdmsbE/edit',
  supersedes: ['10_FOR_10X_LEAGUE_RULES_2026 (1).md'],
  note: 'Provisional working guideline for the 2026 season. Subject to change as the season approaches; this is a rough draft of the new rules to implement, not a final locked ruleset.',
  update_workflow: 'Edit the source doc, then run `node scripts/import-icloud.mjs` and commit the diff.',
};

const log = (...a) => console.log('[import]', ...a);
const warn = (...a) => console.warn('[import] WARN', ...a);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(relPath, obj) {
  const out = join(CONTENT, relPath);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  log('wrote', relPath);
}

async function writeText(relPath, text) {
  const out = join(CONTENT, relPath);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, text, 'utf8');
  log('wrote', relPath);
}

// --- rules ------------------------------------------------------------------
async function importRules() {
  if (!existsSync(SRC.rulesV4)) { warn('V4 rules source not found, skipping:', SRC.rulesV4); return; }
  const body = await readFile(SRC.rulesV4, 'utf8');
  const frontmatter = [
    '---',
    `version: ${RULES_META.version}`,
    `status: ${RULES_META.status}`,
    `locked: ${RULES_META.locked}`,
    `last_updated: ${RULES_META.last_updated}`,
    `source_file: ${RULES_META.source_file}`,
    'provisional: true',
    'note: >-',
    '  Provisional working guideline for the 2026 season. Subject to change as the',
    '  season approaches. Update via scripts/import-icloud.mjs.',
    '---',
    '',
    '> ⚠️ **Provisional — work in progress.** These 2026 rules are a rough working',
    "> guideline to get the new mechanics on paper. They are **not locked** and will",
    '> change as the season approaches. See `rules.meta.json` for status; re-sync with',
    '> `node scripts/import-icloud.mjs`.',
    '',
  ].join('\n');
  await writeText('rules.md', frontmatter + '\n' + body.replace(/\r\n/g, '\n'));
  await writeJson('rules.meta.json', RULES_META);

  if (existsSync(SRC.rulesSuperseded)) {
    const sup = await readFile(SRC.rulesSuperseded, 'utf8');
    const header = [
      '---',
      'status: superseded',
      'superseded_by: rules.md (V4, 2026-08-08)',
      '---',
      '',
      '> 🗄️ **SUPERSEDED.** This is the earlier rules draft. Its X mechanic — *steal*',
      "> an opponent's player into your OWN flex, declare before Sunday 1pm ET — was",
      '> replaced by V4, where the X is **sabotage** (force a FLEX-eligible player into',
      "> the *opponent's* lineup, declare by Friday 11:59 PM CT). Kept for history only.",
      '> Do not answer rules questions from this file.',
      '',
    ].join('\n');
    await writeText('archive/rules-2026-draft-superseded.md', header + sup.replace(/\r\n/g, '\n'));
  } else {
    warn('superseded rules source not found, skipping archive copy');
  }
}

// --- league + managers + scoring -------------------------------------------
function scoringToMarkdown(s) {
  const rows = Object.entries(s).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '# Scoring — 🔟 FOR $10❌ (Full PPR)',
    '',
    '_Derived from the Sleeper league export. Do not hand-edit — regenerate with_',
    '_`node scripts/import-icloud.mjs`._',
    '',
    '| Setting | Points |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| \`${k}\` | ${v} |`),
    '',
  ];
  return lines.join('\n');
}

async function importLeagueData() {
  if (!existsSync(SRC.league2025)) { warn('league export not found, skipping league/scoring:', SRC.league2025); return; }
  const lg = await readJson(SRC.league2025);

  const league = {
    name: lg.name,
    display_name: '🔟 FOR $10❌',
    sport: lg.sport,
    platform: 'sleeper',
    invite_url: 'http://sleeper.com/i/kMgwLBWeYeXdk',
    generated_at: new Date().toISOString(),
    generated_by: 'import-icloud.mjs',
    commissioner: {
      display_name: 'allsxxing',
      user_id: '1058575263971250176',
      team_name: 'ASH & TETTIES',
      real_name: 'GJ Bordallo',
      handle: '@allsxxing',
    },
    season_chain: [
      { season: '2024', league_id: lg.previous_league_id, status: 'complete', source: 'previous_league_id (confirm via sync-sleeper.mjs)' },
      { season: '2025', league_id: lg.league_id, draft_id: lg.draft_id, status: 'complete', latest_league_winner_roster_id: lg.metadata?.latest_league_winner_roster_id ?? null },
      { season: '2026', league_id: '1370188155843526656', status: 'upcoming' },
    ],
    settings: {
      num_teams: lg.settings.num_teams,
      type: lg.settings.type === 0 ? 'redraft' : String(lg.settings.type),
      best_ball: !!lg.settings.best_ball,
      playoff_teams: lg.settings.playoff_teams,
      playoff_week_start: lg.settings.playoff_week_start,
      trade_deadline_week: lg.settings.trade_deadline,
      trade_review_days: lg.settings.trade_review_days,
      waiver_type: lg.settings.waiver_type === 0 ? 'faab' : String(lg.settings.waiver_type),
      waiver_budget_faab: lg.settings.waiver_budget,
      waiver_day_of_week: lg.settings.waiver_day_of_week,
      max_keepers: lg.settings.max_keepers,
      veto_votes_needed: lg.settings.veto_votes_needed,
      reserve_slots: lg.settings.reserve_slots,
      max_subs: lg.settings.max_subs,
      roster_positions: lg.roster_positions,
    },
    scoring_settings: lg.scoring_settings,
  };
  await writeJson('league.json', league);
  await writeText('scoring.md', scoringToMarkdown(lg.scoring_settings));

  // managers = users joined to rosters by owner_id
  if (!existsSync(SRC.users2025) || !existsSync(SRC.rosters2025)) {
    warn('users/rosters export missing, skipping managers.json');
    return;
  }
  const users = await readJson(SRC.users2025);
  const rosters = await readJson(SRC.rosters2025);
  const rosterByOwner = new Map(rosters.map(r => [r.owner_id, r.roster_id]));

  const managers = users.map(u => ({
    user_id: u.user_id,
    display_name: u.display_name,
    team_name: u.metadata?.team_name ?? null,
    roster_id: rosterByOwner.get(u.user_id) ?? null,
    is_commissioner: u.is_owner === true,
  })).sort((a, b) => (a.roster_id ?? 99) - (b.roster_id ?? 99));

  await writeJson('managers.json', {
    season: '2025',
    source_league_id: lg.league_id,
    generated_at: new Date().toISOString(),
    managers,
  });
}

async function main() {
  log('corpus:', CORPUS);
  await mkdir(CONTENT, { recursive: true });
  await importRules();
  await importLeagueData();
  log('done.');
}

main().catch(err => { console.error('[import] FAILED', err); process.exit(1); });
