---
title: ❌ Champion — Commissioner Workflow
---

# ❌ Champion — Weekly Admin Workflow

The ❌ is commissioner-enforced; Sleeper has no native support. Keep the belt honest
by logging every week to `content/x-champion-log.json`.

**Scope:** Regular season ONLY. No ❌ Lock in the playoffs.

## Week 1

1. After scores finalize, the **highest-scoring team in the whole league** is crowned the first ❌ Champion.
2. Tiebreaker: head-to-head from Week 1 → bench points → commissioner coin flip.
3. Log the holder for Week 1.

## Week 2 and beyond

1. **Monday** — after scores finalize, announce the new/continuing ❌ Champion (crowning template).
2. **Thursday** — post the Call for ❌ Lock in league chat.
3. **By Friday 11:59 PM CT** — the holder publicly names one FLEX-eligible player on their upcoming opponent. That player is locked into the opponent's starting FLEX (can't be benched). No declaration = no lock that week.
4. **Enforce** — if the opponent benches the locked player, note it in the Monday recap (or the league honors the lock via manual scoring).
5. **Transfer** — holder wins → keeps the belt; holder loses → the team that beat them inherits it.
6. **Log the lock** — record the locked player, declared_at, and on-time? on that week's entry. Weeks 1–7 stay manual: record the holder and the result yourself. The sync does not create weeks 2–7 and does not fill a null result on weeks 1–7. If week 7's result is still empty, it will not open week 8. Once that result is `held` or `lost`, a later sync can append week 8.

   From week 8 on, `npm run sync:sleeper` fills a null result once the week is final (`week < state.week`, or the season is over) and appends the next holder when that week's matchups are published and the week is still before the playoffs. It will not overwrite a lock, a declaration, or a note you already wrote. A commissioner score override (`custom_points`, including 0) is the score that decides held or lost.

> It's **sabotage, not theft** — the player goes into the *opponent's* lineup, not the holder's.
