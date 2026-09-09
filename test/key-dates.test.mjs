import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStartDate, weekKickoffDate, deriveKeyDates, EVENT_IDS } from '../scripts/lib/key-dates.mjs';

const SEASON_START = '2026-09-09'; // Wednesday, opens week 1

test('weekStartDate anchors week 1 at season_start_date', () => {
  assert.equal(weekStartDate(SEASON_START, 1), '2026-09-09');
});

test('weekStartDate: trade deadline week 12 lands on 2026-11-25', () => {
  assert.equal(weekStartDate(SEASON_START, 12), '2026-11-25');
});

test('weekKickoffDate: playoffs week 15 kickoff lands on 2026-12-17', () => {
  assert.equal(weekKickoffDate(SEASON_START, 15), '2026-12-17');
});

test('weekStartDate shifts correctly with a non-1 start_week', () => {
  // If the league's start_week were 2 (season_start_date names week 2's opening instead),
  // week 1 should fall a week earlier.
  assert.equal(weekStartDate(SEASON_START, 1, 2), '2026-09-02');
  assert.equal(weekStartDate(SEASON_START, 12, 2), '2026-11-18');
});

test('EVENT_IDS are all valid Google Calendar client-assigned ids (base32hex: a-v, 0-9 only)', () => {
  // Google silently rejects (400 "Invalid resource id value.") any id using w/x/y/z or
  // uppercase — confirmed against the live API. This guards against reintroducing that.
  for (const [key, id] of Object.entries(EVENT_IDS)) {
    assert.match(id, /^[a-v0-9]{5,1024}$/, `EVENT_IDS.${key} = "${id}" is not valid base32hex`);
  }
});

test('EVENT_IDS are frozen literals (renaming strands existing calendar events)', () => {
  assert.deepEqual(EVENT_IDS, {
    draft: 'leaguedraft2026',
    week1: 'leaguekickoff12026',
    tradeDeadline: 'leaguetradedeadline2026',
    playoffs: 'leaguepostseason2026',
  });
});

const FIXTURE = {
  state: { season_start_date: SEASON_START },
  league: { settings: { start_week: 1, trade_deadline: 12, playoff_week_start: 15 } },
  draft: { draft_id: 'd1', start_time: Date.UTC(2026, 8, 6, 22, 0, 0) }, // 2026-09-06T22:00:00Z
};

test('deriveKeyDates produces all 4 events with correct kinds/dates/ids', () => {
  const { events, warnings } = deriveKeyDates(FIXTURE);
  assert.equal(events.length, 4);
  assert.deepEqual(warnings, []);

  const byKind = Object.fromEntries(events.map((e) => [e.kind, e]));

  assert.equal(byKind.draft.id, EVENT_IDS.draft);
  assert.equal(byKind.draft.all_day, false);
  assert.equal(byKind.draft.start, new Date(FIXTURE.draft.start_time).toISOString());

  assert.equal(byKind.week1.id, EVENT_IDS.week1);
  assert.equal(byKind.week1.all_day, true);
  assert.equal(byKind.week1.date, '2026-09-10');

  assert.equal(byKind.trade_deadline.id, EVENT_IDS.tradeDeadline);
  assert.equal(byKind.trade_deadline.date, '2026-11-25');

  assert.equal(byKind.playoffs.id, EVENT_IDS.playoffs);
  assert.equal(byKind.playoffs.date, '2026-12-17');

  for (const e of events) assert.ok(e.derived_from.length > 0);
});

test('deriveKeyDates: null draft.start_time yields no draft event plus a warning, does not throw', () => {
  const { events, warnings } = deriveKeyDates({ ...FIXTURE, draft: { draft_id: 'd1', start_time: null } });
  assert.equal(events.some((e) => e.kind === 'draft'), false);
  assert.equal(events.length, 3);
  assert.ok(warnings.some((w) => w.includes('draft.start_time')));
});

test('deriveKeyDates: missing draft entirely also yields no draft event, no throw', () => {
  const { events } = deriveKeyDates({ ...FIXTURE, draft: null });
  assert.equal(events.some((e) => e.kind === 'draft'), false);
});

test('deriveKeyDates: playoff_week_start <= trade_deadline throws', () => {
  assert.throws(() =>
    deriveKeyDates({
      state: { season_start_date: SEASON_START },
      league: { settings: { start_week: 1, trade_deadline: 15, playoff_week_start: 12 } },
      draft: null,
    })
  );
});

test('deriveKeyDates: missing season_start_date throws', () => {
  assert.throws(() =>
    deriveKeyDates({ state: {}, league: { settings: { trade_deadline: 12, playoff_week_start: 15 } }, draft: null })
  );
});

test('deriveKeyDates: missing trade_deadline or playoff_week_start throws', () => {
  assert.throws(() =>
    deriveKeyDates({ state: { season_start_date: SEASON_START }, league: { settings: { playoff_week_start: 15 } }, draft: null })
  );
  assert.throws(() =>
    deriveKeyDates({ state: { season_start_date: SEASON_START }, league: { settings: { trade_deadline: 12 } }, draft: null })
  );
});
