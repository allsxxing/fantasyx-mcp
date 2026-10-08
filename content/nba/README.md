# 🏀 10 FOR $10🏀 — backend only

Mini league. Same commissioner, same voice, different sport.

This folder is the NBA database. It is not wired to the live site.
NFL stays primary:

- Live HQ reads `content/` at the repo root. It does not read `content/nba/`.
- Sleeper sync script only checks `content/league.json`.
- Do not copy NBA files up into `content/`. Do not point Vercel at this folder.

No NBA site until GJ says so. Rules of play are Sleeper NBA fantasy rules. This folder holds commish copy, dues, draft, links, and chat templates only.

Brand lock: 🏀10 FOR $10🏀 (balls both ends, no spaces, no 💵).
