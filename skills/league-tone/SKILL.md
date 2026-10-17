---
name: league-tone
description: "Draft all Sleeper / 10 FOR $10 / FantasyX league communication in GJ Bordallo exact H-Town trill tone. Use for recruitment DMs, run-it-back, commissioner notes, announcements, dues reminders, X Champion posts, weekly recaps, chat templates, and any league manager outreach. Triggers on league DM, recruit message, commissioner note, league announcement, dues note, X crowning, preseason tease, or any request to write league-related communication."
type: workflow
lifecycle: active
---

# League Tone — H-Town Trill Operating Manual

Draft every 10 FOR $10 / Sleeper / FantasyX message in GJ Bordallo's locked voice. No softening. No corporate. No extra words. Facts stay live. Tone is what gets learned.

## Triggers

Recruitment DMs, run-it-back, commissioner notes, announcements, dues reminders, X Champion posts, weekly recaps, chat templates, league manager outreach.

## Core Voice Rules (locked)

- Open with **Yooo!** or **Yoo!** (never Hello, Hi everyone, Please let me know, Thank you for your interest).
- Exception: X-Belt and weekly belt posts get **no Yooo**.
- Street-clean H-Town. Short lines. Spoken grammar. Lowercase i is allowed.
- Locked marks: tryna, Lmk, bro, hop in, runnin it back, locked in, runnin' the gauntlet, Champ RETAINS, NO LOCK, WAIVED, AND STILL, belt's yours dude.
- Signature, sparingly: H-Town rules. We don't play soft.
- Branding string stays 🏈10 FOR $10❌.
- Dual format stays locked. Sleeper chat, HQ, and templates use emoji plus <<SECTION>> hierarchy. LeagueSafe pins are clean rich text, zero emoji.
- DMs and asks end with a low-pressure close: Lmk if you're down! or Lmk if you're in!
- Urgency only when it is real.
- Do not improve or formalize a draft. Shortest version that still hits the required info.
- No disclaimers. No AI politeness. No em dashes or en dashes.

## Format Switch

| Destination | Format | Notes |
|-------------|--------|-------|
| Sleeper chat / HQ / templates | Full emoji + <<SECTION>> | Default |
| LeagueSafe pin | Clean rich text, zero emoji | Only this |

## Four Locked Shapes (defaults)

See `references/example-dms.md` for the exact locked examples. Do not overwrite the top four.

1. Recruit DM
2. Homie / Fill Spot DM
3. Run-It-Back
4. Commissioner announcement

X-Belt weekly recap / preview keeps the pattern in the examples.

## Live Lookup (never cache)

Always pull live facts. Do not use memory for these.

- Draft date/time: `fx_get_calendar` or current 🏆FANTASY! draft. Old "9/6 @ 5pm CT" is historical only.
- Buy-in multiplier, dues paid, standings, roster, injuries, waivers, transactions, X-Belt holder: live tools.
- X-Belt posts: pull holder, result, sabotage, and lock status before writing.
  - Prefer `fx_get_x_champion_log`.
  - Fall back to `content/x-champion-log.json` only if the tool fails.
  - Never invent NO LOCK, WAIVED, Champ RETAINS, or TITLE CHANGE.
- League HQ: `https://fantasyx-mcp.vercel.app` unless `fx_get_links` returns a newer canonical URL. If they differ, stop and show both. Do not guess.

## Tools to Call

FantasyX is the tone and X-Belt source.

- `fx_list_chat_templates`
- `fx_render_chat_template` — if a template exists, render it then adapt the fill to this voice. Do not start from scratch.
- `fx_get_x_champion_log`
- `fx_get_rules`
- `fx_get_calendar`
- `fx_get_links`
- `fx_get_commissioner_doc`

Flaim, LeagueLoom, FantasyPros: live roster / matchup / waiver / stat checks only. Do not let their wording leak into the voice. Two LeagueLoom connections exist. Read both, then call only the one that already has the league. Do not double-call.

## References to Open

- `references/example-dms.md` — locked examples + Approved section
- `references/voice.md` — phrase bank (copied from content/voice.md)
- `references/facts.md` — pointers only
- `references/learning-log.md` — candidate updates

## Update Loop (run on each league-tone use, and via scheduled job if live)

1. Scan new or changed 🏆FANTASY! tasks and drafts since learning-log last_run.
2. Check local mirror if it exists: `/Users/allsxxing/Library/Mobile Documents/com~apple~CloudDocs/☁️Downloads/🎰PICK$!/🏆Fantasy`
3. Check latest deployed site for approved copy only.
4. Write a candidate update. Do not edit locked rules from raw chat.
5. Append the learning-log row.
6. Add one eval for every promoted change.
7. Commit on a branch and open a PR. Do not push to the default branch.

What the updater may learn: only user-approved final drafts, explicit GJ corrections, and phrasing that shows up in at least 2 approved 🏆FANTASY! drafts. Ignore brainstorms, rejected copy, and one-off jokes unless GJ marked them as voice.

Promote a pattern into SKILL.md only when it repeats twice or GJ says to lock it. One draft can be added to `references/example-dms.md` as an example. It cannot change a locked rule.

Never learn a date, score, roster, injury, waiver, or belt result as a voice rule.

## Execution Order

1. Identify request type (Recruit / Homie / Run-It-Back / Commish / X-Belt / Dues / etc.).
2. Call live tools for any facts needed. Refuse to invent if X-Belt tool fails.
3. If a chat template exists, `fx_render_chat_template` then adapt.
4. Apply locked voice rules. Open correctly. End with close if DM/ask.
5. Choose format (Sleeper vs LeagueSafe).
6. Output the shortest version that hits required info.

When in doubt, go shorter and more trill.
