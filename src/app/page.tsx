import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getData, getDocument, manifest, requireData } from "@/lib/content";
import { parseIcs, upcoming } from "@/lib/ics";
import { RetroChrome } from "@/components/retro-chrome";
import { ConnectTabs } from "@/components/connect-tabs";
import { TerminalBlock } from "@/components/terminal-block";
import {
  splitSections,
  sectionBullets,
  stripHeadingNumbers,
  promoteBoldLabelsToHeadings,
  removeSections,
} from "@/lib/rules-sections";

interface League {
  display_name: string;
  invite_url: string;
  season_chain: Array<{ season: string; status: string }>;
  settings: {
    num_teams: number;
    type: string;
    playoff_teams: number;
    playoff_week_start: number;
    trade_deadline_week: number;
    waiver_budget_faab: number;
    max_keepers: number;
    reserve_slots: number;
    roster_positions: string[];
  };
}

interface SeasonChampion {
  display_name: string;
  team_name: string | null;
}

interface Season {
  season: string;
  status: string;
  champion: SeasonChampion | null;
  member_count: number;
}

interface XChampionWeek {
  week: number;
  holder: string;
  sabotage_player?: string;
  declared_at?: string;
}

interface XChampionLog {
  seasons: Record<string, { status: string; weeks: XChampionWeek[] }>;
}

interface RulesMeta {
  version: string;
  status: string;
  locked: boolean;
  note: string;
}

interface SeasonDraft {
  date_ct?: string;
  status?: string;
  start_time?: number;
}

interface CommissionerNote {
  source_doc_url?: string;
  sections: Array<{ label: string; rows: string[] }>;
}

interface Dues {
  buy_in_base_usd: number;
  structure: string;
  multiplier: { status: string; options: string[] };
  payment_method: string;
}

interface Links {
  sleeper_invite: string;
  leaguesafe?: string | null;
  league_calendar?: {
    label?: string;
    ics_url?: string | null;
    google_url?: string | null;
    webcal_url?: string | null;
  };
}

export default async function Home() {
  const league = requireData<League>("league");
  const rulesMeta = getData<RulesMeta>("rules.meta");
  const rulesDoc = getDocument("rules");
  const dues = requireData<Dues>("dues");
  const links = getData<Links>("links");
  const leagueCalendar = links?.league_calendar;
  const calendarEvents = leagueCalendar?.ics_url
    ? await fetch(leagueCalendar.ics_url, { next: { revalidate: 3600 } })
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`ICS fetch failed: ${res.status}`))))
        .then((raw) => upcoming(parseIcs(raw)).slice(0, 8))
        .catch(() => [] as ReturnType<typeof parseIcs>)
    : [];

  const seasons = manifest.seasons
    .map((year) => getData<Season>(`seasons/${year}`))
    .filter((s): s is Season => Boolean(s));

  const completedCount = seasons.filter((s) => s.status === "complete").length;

  const xLog = requireData<XChampionLog>("x-champion-log");
  const currentXSeason = manifest.seasons[manifest.seasons.length - 1];
  const xWeeks = xLog.seasons[currentXSeason]?.weeks ?? [];

  const commishNote = getData<CommissionerNote>("commissioner-note");

  const inviteUrl = links?.sleeper_invite ?? league.invite_url;
  const duesUrl = links?.leaguesafe ?? "#";
  const currentSeason = seasons.find((s) => s.season === currentXSeason);
  const rulesBody = rulesDoc?.body.replace(/^#\s+.+\n/, "") ?? "";

  const sections = splitSections(rulesBody);
  const seasonDetailBullets = sectionBullets(sections.get("LATEST SEASON DETAILS") ?? "");
  const taglineBullets = sectionBullets(sections.get("TAGLINES") ?? "");
  const SUBHEADER_LABELS = ["Declaration Rule", "Title Transfer"];
  const multiplierBody = promoteBoldLabelsToHeadings(sections.get("BUY-IN MULTIPLIER (X VOTE)") ?? "", SUBHEADER_LABELS);
  const weeklyXBody = promoteBoldLabelsToHeadings(
    sections.get("WEEKLY X CHAMPION (THE MAIN FEATURE)") ?? "",
    SUBHEADER_LABELS,
  );
  const xChampionBody =
    multiplierBody || weeklyXBody
      ? [
          "## THE X — TWO MEANINGS. ONE CROWN.",
          "### BUY-IN MULTIPLIER (X VOTE)",
          multiplierBody,
          "### WEEKLY X CHAMPION (THE MAIN FEATURE)",
          weeklyXBody,
        ].join("\n\n")
      : "";

  const rulesDisplayBody = stripHeadingNumbers(
    removeSections(promoteBoldLabelsToHeadings(rulesBody, SUBHEADER_LABELS), ["LATEST SEASON DETAILS", "TAGLINES"]),
  );

  const seasonDraft = getData<{ draft?: SeasonDraft }>(`seasons/${currentXSeason}`)?.draft;
  const draftDateCt = seasonDraft?.date_ct ?? "9/6/26 5PM CT";
  const draftDisplayStatus = seasonDraft?.status === "pre_draft" ? "scheduled" : (currentSeason?.status ?? "upcoming");

  const formatRosterLine = (positions: string[]) => {
    const benchCount = positions.filter((p) => p === "BN").length;
    const starters = positions.filter((p) => p !== "BN");
    const parts: string[] = [];
    let i = 0;
    while (i < starters.length) {
      const pos = starters[i];
      let n = 1;
      while (i + n < starters.length && starters[i + n] === pos) n += 1;
      if (pos === "FLEX") parts.push(n > 1 ? `(${n}X) FLEX` : "FLEX");
      else for (let k = 0; k < n; k += 1) parts.push(pos);
      i += n;
    }
    const core = parts.join("/");
    return benchCount > 0 ? `${core} + (${benchCount}x) BN` : core;
  };
  const rosterDisplay = formatRosterLine(league.settings.roster_positions);

  return (
    <>
      <RetroChrome />

      <header>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="logo">{league.display_name}</div>
          <nav className="nav-links">
            <a href="#champions">CHAMPIONS</a>
            <a href="#x-belt">❌-BELT</a>
            <a href="#calendar">🏆 CALENDAR</a>
            <a href="#rules">RULES</a>
            <a href="#commish-note">COMMISH</a>
            <a href="#connect">CONNECT</a>
          </nav>
          <div className="system-status">SYS_UP: 00:00:00 | CPU: 12%</div>
        </div>
      </header>

      <div className="container">
        <section className="hero">
          <div className="hero-content">
            <p style={{ color: "var(--accent-retro)", marginBottom: "10px" }}>{"[ CONNECTING TO LEAGUE... ]"}</p>
            <h1>
              League <span>HQ</span> &amp; MCP Server
            </h1>
            <p>
              A remote Model Context Protocol server for the Sleeper fantasy football league{" "}
              {league.display_name}. Bylaws, the ❌ Champion sabotage mechanic, dues, and season history —
              all queryable, all versioned.
            </p>
            <div className="btn-group">
              <a href="#connect" className="btn-retro">
                CONNECT
              </a>
              <a href={inviteUrl} className="btn-retro btn-retro--ghost">
                LEAGUE
              </a>
              <a href={duesUrl} className="btn-retro btn-retro--ghost">
                PAY DUES
              </a>
            </div>
          </div>
          <div className="window-frame">
            <div className="window-header">
              <span>LEAGUE_HQ.SYS</span>
              <div className="window-controls" aria-hidden="true">
                <span className="window-btn">
                  <span className="minimize-icon"></span>
                </span>
                <span className="window-btn">
                  <span className="maximize-icon"></span>
                </span>
                <span className="window-btn window-close">
                  <span className="close-icon"></span>
                </span>
              </div>
            </div>
            <img src="/hero-trophy.svg" alt="League trophy" className="hero-image" />
          </div>
        </section>

        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-val">{league.settings.num_teams}</div>
            <div className="stat-label">Teams</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">${dues.buy_in_base_usd}</div>
            <div className="stat-label">Buy-in</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{league.settings.playoff_teams}</div>
            <div className="stat-label">Playoff Teams</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{completedCount}</div>
            <div className="stat-label">Seasons Complete</div>
          </div>
        </div>

        <section id="champions">
          <h2 className="section-title">Season Champions</h2>
          <div className="portfolio-grid">
            {[...seasons].reverse().map((season) => (
              <div className="project-card" key={season.season}>
                <div className="window-header" style={{ background: "#333", color: "#fff" }}>
                  <span>SEASON_{season.season}</span>
                  <div className="window-controls" aria-hidden="true">
                    <span className="window-btn">
                      <span className="minimize-icon"></span>
                    </span>
                    <span className="window-btn">
                      <span className="maximize-icon"></span>
                    </span>
                    <span className="window-btn window-close">
                      <span className="close-icon"></span>
                    </span>
                  </div>
                </div>
                <div className="project-info">
                  <span className="project-tag">#{season.status.toUpperCase()}</span>
                  <h3 className="project-title">
                    {season.champion ? season.champion.team_name ?? season.champion.display_name : "TBD"}
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {season.champion
                      ? `Champion: ${season.champion.display_name} · ${season.member_count} teams`
                      : `${season.member_count} teams · season ${season.status}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="marquee-container">
        <div className="marquee-text">
          <span>SABOTAGE THE FLEX • </span>
          <span>FULL PPR • </span>
          <span>WINNER TAKE ALL • </span>
          <span>{league.display_name} • </span>
          <span>SABOTAGE THE FLEX • </span>
          <span>FULL PPR • </span>
          <span>WINNER TAKE ALL • </span>
          <span>{league.display_name} • </span>
        </div>
      </div>

      <div className="container">
        <section id="x-belt">
          <h2 className="section-title">❌-BELT</h2>
          <div className="terminal-section">
          <div className="terminal-header">X_CHAMPION_BELT.LOG</div>
          <div className="terminal-row">
            <span className="prompt">{"league@10for10x:~$"}</span>
            <span className="command">fetch x-champion-log --season {currentXSeason}</span>
          </div>
          <div className="terminal-row">
            <span className="output">{"> Belt lineage: highest scorer crowned wk 1, sabotage FLEX each week after."}</span>
          </div>
          {xWeeks.length === 0 ? (
            <div className="terminal-row">
              <span className="output">
                {`> No weeks logged yet for ${currentXSeason} — belt is unclaimed. `}
                <span className="cursor-blink">_</span>
              </span>
            </div>
          ) : (
            xWeeks.map((w) => (
              <div className="terminal-row" key={w.week}>
                <span className="output">
                  {`> WK${w.week}: ${w.holder} holds the belt` +
                    (w.sabotage_player ? ` — sabotaged with ${w.sabotage_player}` : "")}
                </span>
              </div>
            ))
          )}
          <div className="terminal-row">
            <span className="prompt">{"league@10for10x:~$"}</span>
            <span className="command">run connect_protocol.sh</span>
          </div>
          <div className="terminal-row">
            <span className="output">
              {"> Establishing secure connection... "}
              <span className="cursor-blink">_</span>
            </span>
          </div>
          </div>
          {xChampionBody && (
            <div className="markdown-body" style={{ marginTop: "40px" }}>
              <div className="terminal-header">X_MECHANIC.LOG</div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{xChampionBody}</ReactMarkdown>
            </div>
          )}
        </section>

        {rulesMeta && rulesDoc && (
          <section id="rules" style={{ marginBottom: "100px" }}>
            <h2 className="section-title">Rules</h2>
            <div className="window-frame" style={{ padding: "20px", marginBottom: "40px" }}>
              <p style={{ color: "var(--accent-retro)", fontWeight: 700, marginBottom: "10px" }}>
                {rulesMeta.locked ? "✅ LOCKED" : "⚠️ PROVISIONAL"} — {rulesMeta.version} ({rulesMeta.status})
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>{rulesMeta.note}</p>
            </div>

            <h3 style={{ marginBottom: "4px" }}>2026 NFL Season — League Rules</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "30px" }}>
              Version: {rulesMeta.version}
            </p>
            <div className="markdown-body" style={{ marginBottom: "40px" }}>
              <div className="terminal-header">RULES.LOG</div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{rulesDisplayBody}</ReactMarkdown>
            </div>

            {seasonDetailBullets.length > 0 && (
              <TerminalBlock
                title="SEASON_DETAILS.CFG"
                cursor={false}
                commands={[{ command: "cat latest_season_details", output: seasonDetailBullets }]}
              />
            )}

            {taglineBullets.length > 0 && (
              <TerminalBlock
                title="TAGLINES.TXT"
                preserveCase
                commands={[{ command: "cat taglines", output: taglineBullets }]}
              />
            )}

            {currentSeason && (
              <TerminalBlock
                title={`SEASON_${currentSeason.season}.CFG`}
                commands={[
                  {
                    command: "league_overview",
                    output: [
                      `Teams: ${league.settings.num_teams}`,
                      `Type: ${league.settings.type}`,
                      `Playoff teams: ${league.settings.playoff_teams} (starting wk ${league.settings.playoff_week_start})`,
                      `Trade deadline: wk ${league.settings.trade_deadline_week}`,
                      `Keepers: ${league.settings.max_keepers}`,
                    ],
                  },
                  {
                    command: "roster_brkdwn",
                    output: [`Roster: ${rosterDisplay}`, `IR slots: ${league.settings.reserve_slots}`],
                  },
                  {
                    command: "draft_day",
                    output: [`Draft date: ${draftDateCt}`, `Status: ${draftDisplayStatus}`],
                  },
                ]}
              />
            )}
          </section>
        )}

        {leagueCalendar && (leagueCalendar.webcal_url || leagueCalendar.google_url || leagueCalendar.ics_url) && (
          <section id="calendar">
            <h2 className="section-title">🏆 League Calendar</h2>
            <TerminalBlock
              title="🏆 LEAGUE_CALENDAR.SYS"
              cursor={false}
              commands={[
                {
                  command: "cat upcoming_events",
                  output:
                    calendarEvents.length > 0
                      ? calendarEvents.map(
                          (e) => `${e.start.slice(0, 10)} — ${e.summary}${e.location ? ` (${e.location})` : ""}`,
                        )
                      : ["No events loaded yet — subscribe below for updates."],
                },
                {
                  command: "subscribe",
                  output: [
                    leagueCalendar.webcal_url ? `Apple / iCloud: ${leagueCalendar.webcal_url}` : null,
                    leagueCalendar.google_url ? `Google: ${leagueCalendar.google_url}` : null,
                    leagueCalendar.ics_url ? `Raw ICS: ${leagueCalendar.ics_url}` : null,
                  ].filter((line): line is string => Boolean(line)),
                },
              ]}
            />
          </section>
        )}

        {commishNote && commishNote.sections.length > 0 && (
          <section id="commish-note">
            <h2 className="section-title">Commish Note</h2>
            <TerminalBlock
              title="COMMISH_NOTE.TXT"
              preserveCase
              commands={commishNote.sections.map((entry) => ({
                command: `cat ${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
                output: entry.rows,
              }))}
            />
          </section>
        )}

        <footer id="connect">
          <div className="footer-logo">
            <p style={{ color: "var(--accent-retro)", fontSize: "0.8rem", marginBottom: "10px" }}>CONNECT</p>
            <h2>
              MCP
              <br />
              ENDPOINTS
            </h2>
          </div>
          <div style={{ maxWidth: "560px", width: "100%" }}>
            <ConnectTabs
              inviteUrl={inviteUrl}
              duesUrl={duesUrl}
              buyIn={dues.buy_in_base_usd}
              structure={dues.structure}
              multiplierStatus={dues.multiplier.status}
            />
            <p className="copyright" style={{ marginTop: "20px" }}>
              LEAGUE FACTS ARE VERSIONED CONTENT. LIVE STANDINGS VIA SLEEPER.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
