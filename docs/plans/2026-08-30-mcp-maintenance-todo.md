# FantasyX MCP — Maintenance TODO

Captured: 2026-08-30
League: 10 FOR $10❌ · Repo: allsxxing/fantasyx-mcp · HQ: https://fantasyx-mcp.vercel.app
Status: OPEN (1 item already done, awaiting MCP content sync)

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

## 1. Subscription calendar (website first, then subscribe)

Goal: one canonical league calendar people can view on the HQ site and subscribe to from iCloud / Google / Outlook.

- [ ] Pick the stack (preference order)
  - Google Calendar (public, ICS subscribe URL) — simplest, free, iCloud-friendly
  - Apple iCloud calendar public ICS — native for iPhone managers
  - Calendly only if we need booking slots (draft window / vote window), not as the season calendar
- [ ] Create the calendar named `10 FOR $10❌ 2026`
- [ ] Seed events (use locked dates only; leave TBD events as tentative all-day or TBD title)
  - Draft Day — Sun, Sept 6 @ 5:00 PM CT (from current commissioner-note)
  - Payment / buy-in deadline — 9/9 7:20 PM (from current dues-note; confirm before publishing)
  - Regular season kickoff / Week 1
  - Trade deadline — Sleeper: Week 11 (confirm live setting)
  - Playoffs start — Sleeper: 6 teams from Week 15 (confirm live setting)
  - Multiplier vote window — tentative: draft day → after Week 1
  - LeagueSafe multiplier / bonus dues deadline — currently listed 10/1/26 in dues-note (confirm; still tentative)
  - X title explanation drop — after draft, before Week 1
  - New league notes publish date — closer to draft day
- [ ] Publish public ICS + embed on fantasyx HQ / landing page first
- [ ] Add subscribe links: Google, Apple Calendar / iCloud, Outlook
- [ ] Optional later: MCP resource `fx_league_calendar` pointing at the ICS + event list (do not duplicate dates in a second markdown authority file)

Decision note: Calendly is scheduling, not a season calendar. Default to Google Calendar public + ICS unless booking UI is actually needed.

---

## 2. New league notes (replace current)

- [ ] Draft replacement commissioner notes (release closer to draft day)
- [ ] Notes replace the existing Sleeper + MCP commissioner note — do not leave two live versions
- [ ] Must stay consistent with locked V5 rules (`rules.md` / iCloud source)
- [ ] Include: roster shape after flex vote, draft details, dues/SleeperSafe + LeagueSafe status, X mechanic pointer, calendar subscribe link once live
- [ ] Update `content/commissioner-note.json` (editable summary only; never contradict `rules.md`)
- [ ] Push to Sleeper commish note + HQ landing when released

---

## 3. X title explanation — chat drop before Week 1

- [ ] Write the X title / X Champion explanation post (league-tone, chat-ready)
- [ ] Timing: after the draft, before Week 1 (ready to fire, not drafted in the moment)
- [ ] Park draft in `content/chat-templates/` (do not create a second rules file that restates the X mechanic)
- [ ] Body must match locked V5 sabotage mechanic (force a FLEX-eligible player into the *opponent's* lineup, Friday 11:59 PM CT) — never the superseded steal-into-own-FLEX draft
- [ ] Post in league chat when triggered

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

## Out of scope

- Do not restating the X mechanic in a new markdown authority file
- Do not hand-edit `content/rules.md` or `content/seasons/*.json`
- Do not put private payment data in the repo
