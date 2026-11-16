import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceXChampion } from '../scripts/lib/x-champion.mjs';

const AUTO_NOTE = 'No lock recorded; chat unverified.';

const MEMBERS = [
  { user_id: 'allsxxing', display_name: 'allsxxing', roster_id: 1 },
  { user_id: 'trappat', display_name: 'trappat', roster_id: 10 },
  { user_id: 'AJk12', display_name: 'AJk12', roster_id: 8 },
  { user_id: 'Maxwellhiggens', display_name: 'Maxwellhiggens', roster_id: 4 },
  { user_id: 'Nels8951', display_name: 'Nels8951', roster_id: 9 },
  { user_id: 'nichigh', display_name: 'nichigh', roster_id: 5 },
];

function row(roster_id, matchup_id, points) {
  return { roster_id, matchup_id, points };
}

// Weeks 8–11 mirror the live 2026 league: 8 and 9 are final, 10 is in progress
// (points already posting), 11 is published with zeros.
const LIVE_WEEKS = {
  6: [row(10, 1, 117.9), row(5, 1, 120.04)],
  7: [row(1, 1, 134.72), row(10, 1, 155.72)],
  8: [row(8, 1, 135.9), row(10, 1, 146.08)],
  9: [row(4, 1, 126.9), row(10, 1, 112.06)],
  10: [row(4, 2, 153.12), row(9, 2, 105.12)],
  11: [row(4, 3, 0), row(6, 3, 0), row(9, 1, 0), row(10, 1, 0)],
  15: [row(4, 1, 10), row(9, 1, 20)],
};

function entry(overrides) {
  return {
    week: 8,
    holder_user_id: 'trappat',
    holder_display_name: 'trappat',
    locked_player_id: null,
    locked_player_name: null,
    locked_into_opponent_user_id: 'AJk12',
    declared_at: null,
    declared_on_time: null,
    result: null,
    notes: 'TITLE CHANGE. Human note. Lock pending.',
    ...overrides,
  };
}

function logOf(weeks, extraSeasons = {}) {
  return {
    description: 'belt',
    rules_ref: 'rules.md',
    seasons: {
      2026: { status: 'in_progress', weeks },
      ...extraSeasons,
    },
  };
}

function ctx(overrides = {}) {
  return {
    season: '2026',
    stateWeek: 10,
    seasonOver: false,
    playoffWeekStart: 15,
    members: MEMBERS,
    matchupsByWeek: LIVE_WEEKS,
    ...overrides,
  };
}

test('held week: records the score, keeps human notes, and appends the same holder', () => {
  const original = logOf([
    entry({
      locked_player_id: '5995',
      locked_player_name: 'Justice Hill',
      declared_at: '2026-10-30T12:00:00-05:00',
      declared_on_time: true,
    }),
  ]);
  const snapshot = structuredClone(original);

  const { log, changed } = advanceXChampion(original, ctx({
    stateWeek: 9,
    matchupsByWeek: { 8: LIVE_WEEKS[8], 9: LIVE_WEEKS[9] },
  }));

  assert.equal(changed, true);
  assert.deepEqual(original, snapshot);
  const [week8, week9] = log.seasons['2026'].weeks;
  assert.equal(week8.result, 'held');
  assert.equal(week8.notes, 'TITLE CHANGE. Human note. Lock pending.');
  assert.equal(week8.locked_player_id, '5995');
  assert.equal(week8.locked_player_name, 'Justice Hill');
  assert.equal(week8.locked_into_opponent_user_id, 'AJk12');
  assert.equal(week8.declared_at, '2026-10-30T12:00:00-05:00');
  assert.equal(week8.declared_on_time, true);
  assert.equal(week9.week, 9);
  assert.equal(week9.holder_user_id, 'trappat');
  assert.equal(week9.holder_display_name, 'trappat');
  assert.equal(week9.crowned_by, undefined);
  assert.equal(week9.locked_player_id, null);
  assert.equal(week9.locked_player_name, null);
  assert.equal(week9.locked_into_opponent_user_id, 'Maxwellhiggens');
  assert.equal(week9.declared_at, null);
  assert.equal(week9.declared_on_time, null);
  assert.equal(week9.result, null);
  assert.equal(week9.notes, AUTO_NOTE);
  assert.equal(JSON.stringify(week9).includes('NO LOCK'), false);
});

test('lost week: crowns the opponent and writes the score onto an auto note', () => {
  const original = logOf([
    entry({ week: 9, holder_user_id: 'trappat', locked_into_opponent_user_id: 'Maxwellhiggens', notes: AUTO_NOTE }),
  ]);

  const { log } = advanceXChampion(original, ctx({
    stateWeek: 10,
    matchupsByWeek: { 9: LIVE_WEEKS[9], 10: LIVE_WEEKS[10] },
  }));

  const [week9, week10] = log.seasons['2026'].weeks;
  assert.equal(week9.result, 'lost');
  assert.equal(
    week9.notes,
    'RESULT: lost to @Maxwellhiggens, @trappat 112.06 to @Maxwellhiggens 126.9. No lock recorded; chat unverified.',
  );
  assert.equal(week9.locked_into_opponent_user_id, 'Maxwellhiggens');
  assert.equal(week10.holder_user_id, 'Maxwellhiggens');
  assert.equal(week10.holder_display_name, 'Maxwellhiggens');
  assert.equal(week10.crowned_by, 'beat_prior_holder');
  assert.equal(week10.locked_into_opponent_user_id, 'Nels8951');
  assert.equal(week10.locked_player_id, null);
  assert.equal(week10.result, null);
  assert.equal(week10.notes, AUTO_NOTE);
});

test('walks final weeks from the open entry and stops on the in-progress week', () => {
  const original = logOf([entry()]);
  const { log, changed } = advanceXChampion(original, ctx());
  const weeks = log.seasons['2026'].weeks;

  assert.equal(changed, true);
  assert.deepEqual(weeks.map(w => w.week), [8, 9, 10]);
  assert.equal(weeks[0].result, 'held');
  assert.equal(weeks[0].notes, 'TITLE CHANGE. Human note. Lock pending.');
  assert.equal(weeks[1].result, 'lost');
  assert.match(weeks[1].notes, /112\.06/);
  assert.match(weeks[1].notes, /126\.9/);
  assert.equal(weeks[1].notes.endsWith(AUTO_NOTE), true);
  assert.equal(weeks[2].result, null);
  assert.equal(weeks[2].holder_user_id, 'Maxwellhiggens');
  assert.equal(weeks[2].locked_into_opponent_user_id, 'Nels8951');
  assert.equal(weeks[2].crowned_by, 'beat_prior_holder');
  assert.equal(weeks[2].notes, AUTO_NOTE);
  assert.equal(weeks.some(w => w.week === 11), false);
  assert.equal(JSON.stringify(weeks.slice(1)).includes('NO LOCK'), false);
});

test('does not rewrite weeks 1-7 or synthesize a successor inside that prefix', () => {
  const week6 = entry({
    week: 6,
    holder_user_id: 'trappat',
    locked_into_opponent_user_id: 'nichigh',
    result: 'lost',
    notes: 'SPECIAL: HIGHEST SCORE WK6 takes the belt. NO LOCK.',
  });
  const week7 = entry({
    week: 7,
    holder_user_id: 'allsxxing',
    locked_into_opponent_user_id: 'trappat',
    result: null,
    notes: 'Crowned on WK6 special. NO LOCK.',
  });
  const onlySix = logOf([week6]);
  const sixResult = advanceXChampion(onlySix, ctx());
  assert.equal(sixResult.changed, false);
  assert.deepEqual(sixResult.log, onlySix);

  const throughSeven = logOf([structuredClone(week6), week7]);
  const sevenResult = advanceXChampion(throughSeven, ctx());
  assert.equal(sevenResult.changed, false);
  assert.equal(sevenResult.log.seasons['2026'].weeks[1].result, null);
  assert.equal(sevenResult.log.seasons['2026'].weeks[1].notes, 'Crowned on WK6 special. NO LOCK.');
  assert.equal(sevenResult.log.seasons['2026'].weeks.length, 2);
});

test('a recorded week 7 result may open week 8 without editing week 7', () => {
  const week7 = entry({
    week: 7,
    holder_user_id: 'allsxxing',
    holder_display_name: 'allsxxing',
    locked_player_id: null,
    locked_into_opponent_user_id: 'trappat',
    result: 'lost',
    notes: 'Crowned on WK6 special. RESULT already written.',
  });
  const { log, changed } = advanceXChampion(logOf([week7]), ctx({
    stateWeek: 8,
    matchupsByWeek: { 7: LIVE_WEEKS[7], 8: LIVE_WEEKS[8] },
  }));
  assert.equal(changed, true);
  const [kept, week8] = log.seasons['2026'].weeks;
  assert.deepEqual(kept, week7);
  assert.equal(week8.week, 8);
  assert.equal(week8.holder_user_id, 'trappat');
  assert.equal(week8.crowned_by, 'beat_prior_holder');
  assert.equal(week8.locked_into_opponent_user_id, 'AJk12');
  assert.equal(week8.result, null);
  assert.equal(week8.notes, AUTO_NOTE);
});

test('does not append the next week when its matchups are not published', () => {
  const { log, changed } = advanceXChampion(logOf([entry()]), ctx({
    stateWeek: 9,
    matchupsByWeek: { 8: LIVE_WEEKS[8] },
  }));
  assert.equal(changed, true);
  assert.equal(log.seasons['2026'].weeks.length, 1);
  assert.equal(log.seasons['2026'].weeks[0].result, 'held');
});

test('treats an empty or matchup-less week as unpublished', () => {
  const { log } = advanceXChampion(logOf([entry()]), ctx({
    stateWeek: 9,
    matchupsByWeek: { 8: LIVE_WEEKS[8], 9: [{ roster_id: 10, matchup_id: null, points: 0 }] },
  }));
  assert.equal(log.seasons['2026'].weeks.length, 1);
  assert.equal(log.seasons['2026'].weeks[0].result, 'held');
});

test('leaves a tie unresolved and does not pass the belt', () => {
  const { log, changed } = advanceXChampion(logOf([entry({ notes: AUTO_NOTE })]), ctx({
    stateWeek: 9,
    matchupsByWeek: { 8: [row(10, 1, 100.5), row(8, 1, 100.5)], 9: LIVE_WEEKS[9] },
  }));
  assert.equal(changed, false);
  assert.equal(log.seasons['2026'].weeks.length, 1);
  assert.equal(log.seasons['2026'].weeks[0].result, null);
  assert.equal(log.seasons['2026'].weeks[0].notes, AUTO_NOTE);
});

test('does not finalize the current week just because points are already posting', () => {
  const week10 = entry({
    week: 10,
    holder_user_id: 'Maxwellhiggens',
    holder_display_name: 'Maxwellhiggens',
    crowned_by: 'beat_prior_holder',
    locked_into_opponent_user_id: 'Nels8951',
    notes: 'TITLE CHANGE. RESULT pending (week in progress).',
  });
  const { log, changed } = advanceXChampion(logOf([week10]), ctx());
  assert.equal(changed, false);
  assert.equal(log.seasons['2026'].weeks.length, 1);
  assert.equal(log.seasons['2026'].weeks[0].result, null);
  assert.equal(log.seasons['2026'].weeks[0].notes, week10.notes);
});

test('stops at playoff_week_start even when that week is published', () => {
  const week14 = entry({
    week: 14,
    notes: AUTO_NOTE,
    locked_into_opponent_user_id: 'AJk12',
  });
  const { log } = advanceXChampion(logOf([week14]), ctx({
    stateWeek: 16,
    seasonOver: false,
    matchupsByWeek: {
      14: [row(10, 1, 140), row(8, 1, 100)],
      15: LIVE_WEEKS[15],
    },
  }));
  assert.deepEqual(log.seasons['2026'].weeks.map(w => w.week), [14]);
  assert.equal(log.seasons['2026'].weeks[0].result, 'held');
  assert.match(log.seasons['2026'].weeks[0].notes, /RESULT: held, @trappat 140 to @AJk12 100\./);
});

test('season over finalizes the belt when state.week has reset', () => {
  const week14 = entry({ week: 14, notes: AUTO_NOTE });
  const { log, changed } = advanceXChampion(logOf([week14]), ctx({
    stateWeek: 1,
    seasonOver: true,
    matchupsByWeek: { 14: [row(10, 1, 90), row(8, 1, 110)] },
  }));
  assert.equal(changed, true);
  assert.equal(log.seasons['2026'].weeks[0].result, 'lost');
  assert.equal(log.seasons['2026'].weeks.length, 1);
});

test('second pass is a no-op and other seasons stay untouched', () => {
  const prior = { status: 'complete', weeks: [entry({ week: 1, result: 'held', notes: 'crown' })] };
  const original = logOf([entry()], { 2025: prior });
  const first = advanceXChampion(original, ctx());
  const second = advanceXChampion(first.log, ctx());
  assert.equal(second.changed, false);
  assert.equal(second.log, first.log);
  assert.deepEqual(first.log.seasons['2025'], prior);
  assert.deepEqual(second.log.seasons['2025'].weeks, prior.weeks);
});

test('does not delete an existing later week', () => {
  const week9 = entry({
    week: 9,
    notes: 'Human week 9 note.',
    locked_player_id: '11586',
    locked_player_name: 'Blake Corum',
    result: null,
  });
  const { log } = advanceXChampion(logOf([entry({ result: 'held' }), week9]), ctx({
    matchupsByWeek: { 9: LIVE_WEEKS[9], 10: LIVE_WEEKS[10] },
  }));
  assert.equal(log.seasons['2026'].weeks.length, 3);
  assert.equal(log.seasons['2026'].weeks[1].locked_player_id, '11586');
  assert.equal(log.seasons['2026'].weeks[1].locked_player_name, 'Blake Corum');
  assert.equal(log.seasons['2026'].weeks[1].notes, 'Human week 9 note.');
  assert.equal(log.seasons['2026'].weeks[1].result, 'lost');
  assert.equal(log.seasons['2026'].weeks[2].week, 10);
});
