# FantasyX MCP — Maintenance TODO

Captured: 2026-08-30 · Updated: 2026-09-08
League: 10 FOR $10❌ · Repo: allsxxing/fantasyx-mcp · HQ: https://fantasyx-mcp.vercel.app
Status: OPEN — draft complete (10/10 rosters), season in progress. Calendar and chat-template
posts still blocked on commissioner action (see items 1–3).

Routine commish maintenance. Do not invent dates, dues amounts, LeagueSafe codes, or X-mechanic wording. Authority stays `content/rules.md` (generated from iCloud source). Never hand-edit generated rules.

---

## DONE — sync through MCP

- [x] Roster-spot poll CLOSED
  - Result: convert 1 extra bench spot → 1 extra FLEX
  - Effect: teams mock-draft against the new roster shape now
  - MCP follow-up still required:
    - Confirm live Sleeper roster settings match the vote
    - `npm run sync:sleeper` so `content/seasons/2026.json` + landing page reflect FLEX+3 / BN-1 vs old CLAUDE.md snapshot (`QB/RB/RB/WR/WR/TE/FLEX/FLEX/K/DEF + 8 BN`)
    - Update commissioner note + any roster copy that still says 2 FLEX / 8 BN
    - Do **not** invent the new slot counts — pull from Sleeper

---

## 1. Subscription calendar (website first, then subscribe) — CODE DONE, STILL awaiting your Google Calendar setup

Goal: one canonical league calendar people can view on the HQ site and subscribe to from iCloud / Google / Outlook, updatable **without a commit**.

Shipped: `src/lib/ics.ts` (dependency-free ICS parser, unit-tested in `test/ics.test.mjs`),
the `fx_get_calendar` MCP tool (`src/tools/content-tools.ts`), and a `🏆 LEAGUE_CALENDAR.SYS`
section on the landing page (`src/app/page.tsx`) — all read `content/links.json`
`league_calendar.ics_url` **live at request time**, so Google Calendar is the write surface
and no redeploy is needed to move a date.

**Status as of 2026-09-08:** `content/links.json → league_calendar.ics_url` is still `null`.
Both the MCP tool and the landing page correctly degrade to subscribe-links-only — that is
the designed fallback, not a bug. The feature stays dark until the calendar exists and its
ICS URL + label are handed over.

- [ ] **You:** create a public Google Calendar and provide its **public ICS address** and its **label** (calendar name)
- [ ] Seed events (use locked dates only; leave TBD events as tentative all-day or TBD title)
  - Draft Day — Sun, Sept 6 @ 5:00 PM CT (complete — historical event now)
  - Payment / buy-in deadline — 9/9 7:20 PM (from current dues-note; confirm before publishing)
  - Regular season kickoff / Week 1 (season is already in progress per Sleeper — confirm real date)
  - Trade deadline — Sleeper: Week 11 (confirm live setting)
  - Playoffs start — Sleeper: 6 teams from Week 15 (confirm live setting)
  - Multiplier vote window — tentative: draft day → after Week 1
  - LeagueSafe multiplier / bonus dues deadline — currently listed 10/1/26 in dues-note (confirm; still tentative)
  - X title explanation drop — after draft, before Week 1
- [ ] **Once you hand over the ICS URL + label:** set `content/links.json` →
  `league_calendar.ics_url` / `google_url` / `webcal_url` / `label`
  (webcal = the ICS url with `https://` swapped for `webcal://`), run `npm run validate`,
  verify both the landing page and `fx_get_calendar` return real events, then commit —
  this is the *only* commit the calendar ever needs; every date after that is a Google
  Calendar edit only.

---

## 2. New league notes (replace current) — DRAFTED, drafts UNCONFIRMED

- [x] Draft replacement commissioner note — `content/chat-templates/post-draft-note.md`
  (render via `fx_render_chat_template` with `draft_recap_note` + `calendar_subscribe_url`)
- [x] `content/commissioner-note.json` ROSTER/FEES rows updated to match live Sleeper settings
  (3x FLEX / 7 BN, SleeperSafe buy-in + LeagueSafe-only bonus)
- [x] `content/commissioner-note.json` DRAFT row updated to reflect completion (10/10 rosters
  filled, draft `status: complete` in `seasons/2026.json`); added a SEASON row pointing to
  the live calendar for kickoff/deadline dates (2026-09-08)
- [ ] **You:** review and confirm `post-draft-note.md` before it is revised further or posted —
  it has not been reviewed since it was drafted in `9113f8d`
- [ ] **You:** post the rendered note to Sleeper once the draft recap text + calendar link are final

---

## 3. X title explanation — chat drop before Week 1 — DRAFTED, drafts UNCONFIRMED

- [x] `content/chat-templates/x-belt-explainer.md` refreshed; confirmed sabotage mechanic +
  Friday 11:59 PM CT deadline, matches locked V5
- [x] `content/chat-templates/x-crowning.md` (Week 2+, prior holder) and the new
  `content/chat-templates/x-crowning-week1.md` (first crowning, league-high + tiebreaker
  chain) both drafted
- [ ] **You:** review and confirm `x-belt-explainer.md`, `x-crowning-week1.md`, and
  `x-multiplier-poll.md` — none have been reviewed since drafting. **No further edits to
  these files until you confirm them.**
- [ ] **You:** post `x-belt-explainer` in league chat after the draft, before Week 1

---

## 4. Multiplier vote (tentative window)

- [ ] Define vote window: anytime from Draft Day → after Week 1
- [ ] Put the window on the calendar as tentative until locked
- [ ] Prep the vote artifact (Sleeper poll + chat template)
- [ ] After vote: update dues docs, LeagueSafe adjustments, commissioner note, calendar event (lock the date)
- [ ] Do not hardcode a multiplier in `rules.md` or dues files until the vote lands

---

## 5. Dues documentation update (SleeperSafe is new; amounts still tentative)

Current live copy (`content/dues-note.md`) is tentative and already split:
- Buy-in via **SleeperSafe** — $10, deadline listed 9/9 7:20 PM
- ❌ bonus / multiplier via **LeagueSafe only** — deadline listed 10/1/26, join `https://www.leaguesafe.com/join/4429630/10-for-10`

- [ ] Rewrite dues docs for the new split (SleeperSafe buy-in vs LeagueSafe multiplier)
- [ ] Mark every unsettled number / date as TENTATIVE until vote + confirmation
- [ ] If multiplier passes: keep buy-in on SleeperSafe; adjust LeagueSafe pot / buy-in to match the voted multiplier
- [ ] Update `content/dues-note.md` + `content/dues.json` together so MCP does not serve two stories
- [ ] Keep payment handles / paid-unpaid list out of git (`FANTASYX_PRIVATE_DATA` only)
- [ ] Refresh punishment copy only if it still matches locked rules (unpaid buy-in = roster lock; unpaid multiplier = limited waivers / vetoable)
- [ ] Do not invent a second LeagueSafe URL or join code

---

## Sequence

1. Sync roster settings from Sleeper (flex vote is already decided)
2. Stand up calendar + ICS embed on the site
3. Draft new league notes + X title chat post so both are ready before draft week
4. Lock dues copy as far as SleeperSafe allows; leave multiplier language tentative
5. Run multiplier vote in the draft-day → post-Week-1 window
6. Patch dues + calendar + notes after the vote

---

## 6. Hero graphic — RESTARTED from original (2026-09-08)

`9113f8d` replaced `public/hero-trophy.svg` with a hand-drawn `hero-belt.svg`; `8b5b77a`
reverted that swap back to the original trophy art. The belt attempt was scrapped, not
resumed.

- [x] `public/hero-belt.svg` recreated as an exact copy of `public/hero-trophy.svg` — the
  original trophy art is preserved untouched; the belt file is the new working base
- [ ] **You:** generate reference art (prompt captured in the plan file used for this
  session) and iterate `public/hero-belt.svg` against it
- [ ] `src/app/page.tsx` still points at `/hero-trophy.svg` — only flip to `/hero-belt.svg`
  once the new art is approved

---

## Out of scope

- Do not restating the X mechanic in a new markdown authority file
- Do not hand-edit `content/rules.md` or `content/seasons/*.json`
- Do not put private payment data in the repo
