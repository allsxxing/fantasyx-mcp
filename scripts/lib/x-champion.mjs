// x-champion.mjs — pure advance of content/x-champion-log.json from Sleeper matchups.
// No I/O. sync-sleeper.mjs fetches; this decides what may be appended or filled.
//
// The belt is regular season only and weeks 1–7 are a closed prefix (crown week,
// waived locks, the week-6 highest-score poll). This module never rewrites those
// entries. It also never writes a "NO LOCK" claim, never deletes a week, and never
// touches locked_player_*, declared_at, declared_on_time, locked_into_opponent_user_id,
// or human-written notes on an entry that already exists. A null result on a FINAL
// week after week 7 is filled held/lost. The score is written into notes only when
// the note is still the auto placeholder (or empty). The next week is appended only
// when that week's matchups are published and the week is still before playoffs.

export const AUTO_NOTE = 'No lock recorded; chat unverified.';
export const PROTECTED_WEEK_MAX = 7;

function rowsFor(ctx, week) {
  const map = ctx.matchupsByWeek ?? {};
  return map[week] ?? map[String(week)] ?? null;
}

function isPublished(rows) {
  return Array.isArray(rows) && rows.some(r => r && r.matchup_id != null);
}

function isAutoNotes(notes) {
  if (notes == null) return true;
  const text = String(notes).trim();
  return text === '' || text === AUTO_NOTE;
}

function formatPoints(n) {
  return String(Math.round(Number(n) * 100) / 100);
}

function findSide(userId, rows, members) {
  if (!isPublished(rows)) return null;
  const holder = members.find(m => m.user_id === userId);
  if (holder?.roster_id == null) return null;
  const holderRow = rows.find(r => r.roster_id === holder.roster_id && r.matchup_id != null);
  if (!holderRow) return null;
  const oppRow = rows.find(r => r.matchup_id === holderRow.matchup_id && r.roster_id !== holder.roster_id);
  if (!oppRow) return null;
  const opponent = members.find(m => m.roster_id === oppRow.roster_id);
  if (!opponent) return null;
  return { holder, holderRow, opponent, oppRow };
}

function resolveOutcome(entry, ctx) {
  const side = findSide(entry.holder_user_id, rowsFor(ctx, entry.week), ctx.members ?? []);
  if (!side) return null;
  if (side.holderRow.points == null || side.oppRow.points == null) return null;
  const holderPoints = Number(side.holderRow.points);
  const opponentPoints = Number(side.oppRow.points);
  if (!Number.isFinite(holderPoints) || !Number.isFinite(opponentPoints)) return null;
  const holderCents = Math.round(holderPoints * 100);
  const opponentCents = Math.round(opponentPoints * 100);
  return {
    holderPoints,
    opponentPoints,
    tie: holderCents === opponentCents,
    won: holderCents > opponentCents,
    holder: side.holder,
    opponent: side.opponent,
  };
}

function resultSentence(outcome, result) {
  const holder = outcome.holder.display_name ?? outcome.holder.user_id;
  const opp = outcome.opponent.display_name ?? outcome.opponent.user_id;
  const hp = formatPoints(outcome.holderPoints);
  const op = formatPoints(outcome.opponentPoints);
  if (result === 'held') return `RESULT: held, @${holder} ${hp} to @${opp} ${op}.`;
  return `RESULT: lost to @${opp}, @${holder} ${hp} to @${opp} ${op}.`;
}

function nextHolder(entry, ctx) {
  const members = ctx.members ?? [];
  if (entry.result === 'held') {
    const member = members.find(m => m.user_id === entry.holder_user_id);
    return {
      user_id: entry.holder_user_id,
      display_name: member?.display_name ?? entry.holder_display_name ?? null,
    };
  }
  if (entry.result === 'lost') {
    const side = findSide(entry.holder_user_id, rowsFor(ctx, entry.week), members);
    if (!side) return null;
    return { user_id: side.opponent.user_id, display_name: side.opponent.display_name ?? null };
  }
  return null;
}

function blankWeek(week, holder, opponentUserId, crowned) {
  const entry = {
    week,
    holder_user_id: holder.user_id,
    holder_display_name: holder.display_name ?? null,
    locked_player_id: null,
    locked_player_name: null,
    locked_into_opponent_user_id: opponentUserId,
    declared_at: null,
    declared_on_time: null,
    result: null,
    notes: AUTO_NOTE,
  };
  if (!crowned) return entry;
  return {
    week: entry.week,
    holder_user_id: entry.holder_user_id,
    holder_display_name: entry.holder_display_name,
    crowned_by: 'beat_prior_holder',
    locked_player_id: null,
    locked_player_name: null,
    locked_into_opponent_user_id: opponentUserId,
    declared_at: null,
    declared_on_time: null,
    result: null,
    notes: AUTO_NOTE,
  };
}

/**
 * @returns {{ log: object, changed: boolean, warnings: string[] }}
 * `log` is the input reference when nothing changed.
 */
export function advanceXChampion(log, ctx = {}) {
  const warnings = [];
  const seasonKey = String(ctx.season ?? '');
  const season = log?.seasons?.[seasonKey];
  if (!season?.weeks?.length) return { log, changed: false, warnings };

  const playoff = Number(ctx.playoffWeekStart);
  if (!Number.isInteger(playoff) || playoff < 2) {
    warnings.push('playoffWeekStart missing — skipping belt');
    return { log, changed: false, warnings };
  }

  const sourceWeeks = season.weeks;
  for (let i = 1; i < sourceWeeks.length; i++) {
    if (!(sourceWeeks[i].week > sourceWeeks[i - 1].week)) {
      warnings.push('x-champion weeks are not strictly increasing — skipping belt');
      return { log, changed: false, warnings };
    }
  }

  const stateWeek = Number(ctx.stateWeek);
  const seasonOver = ctx.seasonOver === true;
  const next = structuredClone(log);
  const weeks = next.seasons[seasonKey].weeks;
  let changed = false;

  const fill = (entry) => {
    if (entry.week >= playoff) return 'stop';
    if (entry.week <= PROTECTED_WEEK_MAX) return 'skip';
    if (entry.result != null) return 'skip';
    if (!(seasonOver || entry.week < stateWeek)) return 'stop';
    const outcome = resolveOutcome(entry, ctx);
    if (!outcome) {
      warnings.push(`week ${entry.week}: matchup not resolvable — leaving result null`);
      return 'stop';
    }
    if (outcome.tie) {
      warnings.push(`week ${entry.week}: tie — leaving result null`);
      return 'stop';
    }
    entry.result = outcome.won ? 'held' : 'lost';
    if (isAutoNotes(entry.notes)) {
      entry.notes = `${resultSentence(outcome, entry.result)} ${AUTO_NOTE}`;
    }
    changed = true;
    return 'filled';
  };

  for (const entry of weeks) {
    if (fill(entry) === 'stop') break;
  }

  for (let guard = 0; guard < 30; guard++) {
    if (weeks.some(w => w.week > PROTECTED_WEEK_MAX && w.result == null)) break;
    const entry = weeks[weeks.length - 1];
    if (entry.result !== 'held' && entry.result !== 'lost') break;
    const upcoming = entry.week + 1;
    if (upcoming <= PROTECTED_WEEK_MAX) break;
    if (upcoming >= playoff) break;
    if (weeks.some(w => w.week === upcoming)) break;

    const rows = rowsFor(ctx, upcoming);
    if (!isPublished(rows)) {
      warnings.push(`week ${upcoming}: matchups not published — not appending`);
      break;
    }
    const holder = nextHolder(entry, ctx);
    if (!holder?.user_id) {
      warnings.push(`week ${upcoming}: could not resolve the next holder — not appending`);
      break;
    }
    const opponent = findSide(holder.user_id, rows, ctx.members ?? [])?.opponent;
    if (!opponent?.user_id) {
      warnings.push(`week ${upcoming}: opponent missing from published matchups — not appending`);
      break;
    }
    weeks.push(blankWeek(upcoming, holder, opponent.user_id, entry.result === 'lost'));
    changed = true;
    if (fill(weeks[weeks.length - 1]) !== 'filled') break;
  }

  return { log: changed ? next : log, changed, warnings };
}
