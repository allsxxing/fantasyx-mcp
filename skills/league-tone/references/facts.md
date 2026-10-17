# Facts Pointers (no cached values)

Live only. Never hardcode.

- Draft date / time: call `fx_get_calendar` or check current 🏆FANTASY! draft event. Historical example "9/6 @ 5pm CT" is not live.
- League HQ canonical: `https://fantasyx-mcp.vercel.app` (confirm with `fx_get_links`). If tool returns different, stop and show both.
- X-Belt holder / result / sabotage / lock status: `fx_get_x_champion_log` first. Fall back to repo `content/x-champion-log.json` only on tool failure. Never invent.
- Buy-in base: $10 SleeperSafe. Multiplier / dues paid status: live via LeagueSafe or commissioner docs. Do not cache.
- Standings, roster, injuries, waivers, transactions: Flaim / LeagueLoom / FantasyPros. Wording does not leak into voice.
- Chat templates: `fx_list_chat_templates` then `fx_render_chat_template`.
- Rules: `fx_get_rules`.

Pointers only. No scores, no current holder, no paid status stored here.
