# Sleeper sync automation — design record

**Date:** 2026-08-16
**Status:** implemented

## Problem

Commit `810d548` added `content/seasons/2026-draft-order.json` and rewrote
`content/managers.json` by hand, transcribed from a commissioner screenshot
(`IMG_4135.jpeg`). Three things were wrong with that:

1. **It broke content validation.** `validate-content.mjs` matches any `seasons/*.json`
   against `season.schema.json`. The new file's `status` was `"randomized_upcoming_draft"`
   (not in the enum) and its `source` was an object where the schema wants a string.
   `npm run validate` was red at HEAD.

2. **It created a second authority for the 2026 roster.** The screenshot files said 10
   members with roster 3 = anyfoolwilldo and roster 4 = Maxwellhiggens; `seasons/2026.json`
   said 9 members with roster 3 open and roster 4 = olavegarden2828. Both were compiled into
   the generated content module and served over MCP, so the server had two answers to one
   question. This is the drift failure CLAUDE.md already warns about for rules documents —
   the same reasoning applies to roster data.

3. **It hand-typed something Sleeper knows.** Draft order is live at
   `/v1/draft/{draft_id}`. Transcribing it violates the project's core split: what Sleeper
   knows is fetched, never typed.

A fourth, quieter bug: `seasons/2026.json` carried a hand-added `draft` block that
`sync-sleeper.mjs` did not write, so the next sync would have silently deleted it.

## Decisions

### Draft order is resolved, never transcribed

`sync-sleeper.mjs` now fetches `/draft/{draft_id}` for every league in the chain and derives
the order by joining two Sleeper maps — `draft.draft_order` (`user_id → slot`) and
`draft.slot_to_roster_id` (`slot → roster_id`) — against the members list the script already
computes.

Before Sleeper randomizes, `draft.draft_order` is `null`. In that case the script writes
`draft_order: null` and logs a warning. **The absence of an order is itself a fact.** It is
never filled in with a guess, a shuffle, or a screenshot. A null here is correct; a plausible
invented order is a lie the MCP server would repeat with confidence.

The `date_ct` display string that was hand-set in `seasons/2026.json` is not reproduced.
`start_time` (epoch ms, as Sleeper returns it) is the fact; formatting is a render concern.

### `2026-draft-order.json` deleted, not archived

Its only unique payload now comes from the API into `seasons/2026.json`. `content/archive/`
holds superseded *source* documents (like the 2026 rules draft); this file was never a source,
just a transcription. Deleting it fixes validation and collapses two authorities into one.

### `managers.json` became a sync output

It duplicated what `seasons/2026.json` already held, and no MCP tool read it —
`fx_list_managers` reads `seasons/2026`. Rather than retire it, the sync now generates it from
the same live `members` array, so the two files cannot disagree by construction.
`is_commissioner` is set by comparing against `league.json`'s `commissioner.user_id`, matching
what `src/tools/content-tools.ts` does at request time.

The hand-edit path is what caused this incident, so it is now closed: the file carries a
generated-by header and CLAUDE.md names it alongside `rules.md` as never-hand-edited.

### The roster conflict was not resolved by hand

Neither snapshot was adopted. The sync script is the arbiter; its first run overwrites both
files from live Sleeper and regenerates the `roster_changes` diff off the 2025 chain. Picking
a winner by eye would have re-created the same class of error the incident was about.

## Schedule rationale

GitHub cron has no per-date gating, so the phases are three `schedule` entries with one job
behind them, and the no-change guard makes an out-of-phase run a clean no-op.

| Phase | Cadence | Why |
|---|---|---|
| Preseason / draft window | Twice daily | Draft randomization and the last open seat are what move hour-to-hour in August. |
| In-season | Tuesdays ~8am CT | After Monday night finalizes; standings and transactions settle weekly. |
| Offseason | Monthly | Nothing changes; this is a heartbeat. |

`npm run validate` gates the commit. Content that fails its schema is never pushed — that is
the check `810d548` bypassed by going through the GitHub web UI.

`npm run build:content` is deliberately *not* run here: `src/generated/` is gitignored and
Vercel's `prebuild` regenerates it at deploy time.

`permissions: contents: write` is scoped in the workflow file, so no repo-settings change and
no PAT are needed.

## Provenance note

This work was handed off from a Claude chat that hit a 403 on GitHub's tree-write endpoint
(no write scope on the chat connector) after preparing four files. Those file *contents* never
reached the implementing session — only their paths — so the change was re-derived from the
repository rather than pasted. That turned out to be the better path: the repo state showed
defects (the failing validation, the roster conflict) that the original patch may or may not
have addressed.
