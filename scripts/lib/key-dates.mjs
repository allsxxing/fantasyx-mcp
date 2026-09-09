// key-dates.mjs — pure derivation of the four Sleeper-authoritative calendar dates
// (Draft Day, Week 1 Kickoff, Trade Deadline, Playoffs Start). No I/O, no fetch — takes
// already-fetched Sleeper data and returns plain objects, so this unit-tests directly.
//
// Anchor rule (ASSUMPTION, not a Sleeper-guaranteed fact): /v1/state/nfl's
// season_start_date is the date that OPENS NFL week 1 (a Wednesday); games begin the
// next day (Thursday). Every week is a 7-day block from that anchor. This is an inference
// from observed Sleeper behavior, not a documented contract — hence `assumptions[]` below
// and a `derived_from` string on every event so a human can audit the inference.
//
// Deliberately frozen event IDs — Google Calendar client-supplied IDs must be lowercase
// base32hex ONLY: a-v and 0-9 (no w/x/y/z — Google rejects them with a bare "Invalid
// resource id value.", confirmed against the live API). Renaming any of these strands the
// existing calendar event under the old id instead of updating it; a test asserts these
// literals so a rename fails CI.
export const EVENT_IDS = {
  draft: 'leaguedraft2026',
  week1: 'leaguekickoff12026',
  tradeDeadline: 'leaguetradedeadline2026',
  playoffs: 'leaguepostseason2026',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** The date (YYYY-MM-DD) that opens NFL week `week`, given the season's week-1 opening date. */
export function weekStartDate(seasonStartDate, week, startWeek = 1) {
  return addDays(seasonStartDate, 7 * (week - startWeek));
}

/** The first game day (YYYY-MM-DD) of NFL week `week` — the day after that week opens. */
export function weekKickoffDate(seasonStartDate, week, startWeek = 1) {
  return addDays(weekStartDate(seasonStartDate, week, startWeek), 1);
}

/**
 * Derive the four managed calendar events from a Sleeper league bundle.
 * @param {{ state: object, league: object, draft: object|null }} input
 * @returns {{ events: object[], assumptions: string[], warnings: string[] }}
 */
export function deriveKeyDates({ state, league, draft }) {
  const seasonStartDate = state?.season_start_date;
  const startWeek = league?.settings?.start_week ?? 1;
  const tradeDeadlineWeek = league?.settings?.trade_deadline;
  const playoffWeekStart = league?.settings?.playoff_week_start;

  if (!seasonStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(seasonStartDate)) {
    throw new Error(`deriveKeyDates: missing/unparseable state.season_start_date (got ${JSON.stringify(seasonStartDate)})`);
  }
  if (tradeDeadlineWeek == null) {
    throw new Error('deriveKeyDates: league.settings.trade_deadline is missing');
  }
  if (playoffWeekStart == null) {
    throw new Error('deriveKeyDates: league.settings.playoff_week_start is missing');
  }
  if (playoffWeekStart <= tradeDeadlineWeek) {
    throw new Error(`deriveKeyDates: playoff_week_start (${playoffWeekStart}) must be after trade_deadline (${tradeDeadlineWeek})`);
  }

  const assumptions = [
    `season_start_date (${seasonStartDate}) from /v1/state/nfl is assumed to be the Wednesday that opens NFL week 1; games are assumed to begin the following day.`,
  ];
  const warnings = [];

  const events = [];

  if (draft?.start_time) {
    const start = new Date(draft.start_time).toISOString();
    const end = new Date(draft.start_time + 2 * 60 * 60 * 1000).toISOString();
    events.push({
      id: EVENT_IDS.draft,
      title: '🏆 10 FOR $10❌ — Draft Day',
      kind: 'draft',
      all_day: false,
      start,
      end,
      timezone: 'America/Chicago',
      derived_from: `draft.start_time (${draft.start_time}) from sleeper /v1/draft/${draft.draft_id}`,
    });
  } else {
    warnings.push('draft.start_time is not set yet (order/time not randomized) — no Draft Day event emitted; do not guess one.');
  }

  const week1Date = weekKickoffDate(seasonStartDate, 1, startWeek);
  events.push({
    id: EVENT_IDS.week1,
    title: '🏆 10 FOR $10❌ — Week 1 Kickoff',
    kind: 'week1',
    all_day: true,
    date: week1Date,
    derived_from: `weekKickoffDate(season_start_date=${seasonStartDate}, week=1, start_week=${startWeek})`,
  });

  const tradeDeadlineDate = weekStartDate(seasonStartDate, tradeDeadlineWeek, startWeek);
  events.push({
    id: EVENT_IDS.tradeDeadline,
    title: '🏆 10 FOR $10❌ — Trade Deadline (Week ' + tradeDeadlineWeek + ' Start)',
    kind: 'trade_deadline',
    all_day: true,
    date: tradeDeadlineDate,
    derived_from: `weekStartDate(trade_deadline=${tradeDeadlineWeek}) from state.season_start_date=${seasonStartDate}`,
  });

  const playoffsDate = weekKickoffDate(seasonStartDate, playoffWeekStart, startWeek);
  events.push({
    id: EVENT_IDS.playoffs,
    title: '🏆 10 FOR $10❌ — Playoffs Begin (Week ' + playoffWeekStart + ')',
    kind: 'playoffs',
    all_day: true,
    date: playoffsDate,
    derived_from: `weekKickoffDate(playoff_week_start=${playoffWeekStart}) from state.season_start_date=${seasonStartDate}`,
  });

  return { events, assumptions, warnings };
}
