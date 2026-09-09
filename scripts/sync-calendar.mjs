#!/usr/bin/env node
// sync-calendar.mjs — pushes the 4 managed events from content/key-dates.json (written by
// sync-sleeper.mjs) into the league's Google Calendar. Deliberately separate from
// sync-sleeper.mjs: that script is credential-free and locally runnable; this one is a
// credentialed network write to a shared, human-visible artifact, and must never be able
// to fail the repo-side sync.
//
// Self-guards on missing credentials (log + exit 0) so it's a clean no-op in CI on forks/
// PRs where GCAL_SA_KEY is an empty secret, and a clean no-op for anyone running this
// locally without the key.
//
// Only ever touches the 4 client-assigned deterministic event ids from key-dates.mjs — it
// never lists or deletes calendar events, so it is structurally incapable of touching any
// human-authored event (LeagueSafe due date, punishment placeholder, X-Champion cadence).

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, getEvent, upsertEvent } from './lib/gcal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_DATES_PATH = join(__dirname, '..', 'content', 'key-dates.json');

const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

const log = (...a) => console.log('[sync-calendar]', ...a);
const warn = (...a) => console.warn('[sync-calendar] WARN', ...a);

// Required on every synced event's description, per commissioner convention.
const LEAGUE_LINE = 'League: 🏆 10 FOR $10❌ — https://sleeper.com/leagues/1370188155843526656/team';

function toGoogleEvent(e) {
  const description = `${LEAGUE_LINE}\n\n${e.derived_from}\n\nAuto-synced from Sleeper — edits here are overwritten; change it in Sleeper.`;
  if (e.all_day) {
    // Google all-day events use exclusive end dates; a single-day event's end is start+1.
    const [y, m, d] = e.date.split('-').map(Number);
    const end = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    return { summary: e.title, description, start: { date: e.date }, end: { date: end } };
  }
  return {
    summary: e.title,
    description,
    start: { dateTime: e.start, timeZone: e.timezone ?? 'America/Chicago' },
    end: { dateTime: e.end, timeZone: e.timezone ?? 'America/Chicago' },
  };
}

async function main() {
  const rawKey = process.env.GCAL_SA_KEY;
  const calendarId = process.env.GCAL_CALENDAR_ID;

  if (!rawKey || !calendarId) {
    if (DRY_RUN) {
      // No credentials to diff against the live calendar (e.g. a fork/PR) — still show what
      // would be pushed, sourced from the already-committed derived file.
      log('GCAL_SA_KEY/GCAL_CALENDAR_ID not set — showing derived events from content/key-dates.json only (no live diff possible):');
      const keyDates = JSON.parse(await readFile(KEY_DATES_PATH, 'utf8'));
      for (const e of keyDates.events ?? []) log(`  ${e.id}: ${e.title} — ${e.all_day ? e.date : e.start}`);
      process.exit(0);
    }
    log('GCAL_SA_KEY or GCAL_CALENDAR_ID not set — skipping (this is a clean no-op, not a failure).');
    process.exit(0);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawKey);
  } catch (err) {
    console.error('[sync-calendar] FAILED: GCAL_SA_KEY is not valid JSON:', err.message);
    process.exit(1);
  }

  const keyDates = JSON.parse(await readFile(KEY_DATES_PATH, 'utf8'));
  if (!keyDates.events?.length) {
    warn('content/key-dates.json has no events — nothing to sync.');
    process.exit(0);
  }

  const accessToken = await getAccessToken(serviceAccount);

  for (const e of keyDates.events) {
    const desired = toGoogleEvent(e);
    if (DRY_RUN) {
      const current = await getEvent(accessToken, calendarId, e.id);
      if (!current) {
        log(`WOULD INSERT ${e.id}: ${JSON.stringify(desired)}`);
      } else {
        const diffFields = ['summary', 'description'].filter((f) => current[f] !== desired[f]);
        const startChanged = JSON.stringify(current.start) !== JSON.stringify(desired.start);
        const endChanged = JSON.stringify(current.end) !== JSON.stringify(desired.end);
        if (diffFields.length || startChanged || endChanged) {
          log(`WOULD PATCH ${e.id}:`);
          for (const f of diffFields) log(`  ${f}: ${JSON.stringify(current[f])} → ${JSON.stringify(desired[f])}`);
          if (startChanged) log(`  start: ${JSON.stringify(current.start)} → ${JSON.stringify(desired.start)}`);
          if (endChanged) log(`  end: ${JSON.stringify(current.end)} → ${JSON.stringify(desired.end)}`);
        } else {
          log(`UNCHANGED ${e.id}`);
        }
      }
      continue;
    }

    try {
      const { action } = await upsertEvent(accessToken, calendarId, e.id, desired);
      log(`${action} ${e.id} (${e.title})`);
    } catch (err) {
      console.error(`[sync-calendar] FAILED to upsert ${e.id}:`, err.message);
      console.error(`[sync-calendar] Check: the calendar (${calendarId}) is shared with the service account (${serviceAccount.client_email}) as an editor/writer, and the SA key hasn't been revoked.`);
      process.exit(1);
    }
  }

  log(DRY_RUN ? 'dry run complete.' : 'sync complete.');
}

main().catch((err) => {
  console.error('[sync-calendar] FAILED', err);
  process.exit(1);
});
