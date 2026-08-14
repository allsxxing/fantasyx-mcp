import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getData, getDocument, manifest, requireData } from "@/lib/content";
import { RetroChrome } from "@/components/retro-chrome";
import { ConnectTabs } from "@/components/connect-tabs";
import { TerminalBlock } from "@/components/terminal-block";
import { splitSections, sectionBullets } from "@/lib/rules-sections";

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
}

export default async function Home() {
  const league = requireData<League>("league");
  const rulesMeta = getData<RulesMeta>("rules.meta");
  const rulesDoc = getDocument("rules");
  const dues = requireData<Dues>("dues");
  const links = getData<Links>("links");

  const seasons = manifest.seasons
    .map((year) => getData<Season>(`seasons/${year}`))
    .filter((s): s is Season => Boolean(s));

  const completedCount = seasons.filter((s) => s.status === "complete").length;

  const xLog = requireData<XChampionLog>("x-champion-log");
  const currentXSeason = manifest.seasons[manifest.seasons.length - 1];
  const xWeeks = xLog.seasons[currentXSeason]?.weeks ?? [];

  const inviteUrl = links?.sleeper_invite ?? league.invite_url;
  const duesUrl = links?.leaguesafe ?? "#";
  const currentSeason = seasons.find((s) => s.season === currentXSeason);
  const rulesBody = rulesDoc?.body.replace(/^#\s+.+\n/, "") ?? "";

  const sections = splitSections(rulesBody);
  const seasonDetailBullets = sectionBullets(sections.get("LATEST SEASON DETAILS") ?? "");
  const taglineBullets = sectionBullets(sections.get("TAGLINES") ?? "");
  const xChampionBody = sections.get("WEEKLY X CHAMPION (THE MAIN FEATURE)") ?? "";

  const seasonDraft = getData<{ draft?: SeasonDraft }>(`seasons/${currentXSeason}`)?.draft;
  const draftDateCt = seasonDraft?.date_ct ?? "TBD";

  const benchCount = league.settings.roster_positions.filter((p) => p === "BN").length;
  const nonBenchPositions = league.settings.roster_positions.filter((p) => p !== "BN");
  const rosterDisplay =
    benchCount > 0
      ? `${nonBenchPositions.join("/")} + (${benchCount}x) BN`
      : league.settings.roster_positions.join("/");

  return (
    <>
      <RetroChrome />

      <header>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="logo">{league.display_name}</div>
          <nav className="nav-links">
            <a href="#champions">CHAMPIONS</a>
            <a href="#x-belt">❌-BELT</a>
            <a href="#rules">RULES</a>
            <a href="#connect">CONNECT</a>
          </nav>
          <div className="system-status">SYS_UP: 00:00:00 | CPU: 12%</div>
        </div>
      </header>

      <div className="container">
        {/* Hero */}
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

        {/* Stats */}
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

        {/* Season Champions */}
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

      {/* Marquee */}
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
        {/* X Champion Belt terminal */}
        <section id="x-belt">
          <h2 className="section-title">❌-BELT</h2>
          <div className="terminal-section">
          <div className="terminal-header">X_CHAMPION_BELT.LOG</div>
          <div className="terminal-row">
            <span className="prompt">{"guest@league:~$"}</span>
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
            <span className="prompt">{"guest@league:~$"}</span>
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{xChampionBody}</ReactMarkdown>
            </div>
          )}
        </section>

        {/* Rules strip */}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{rulesBody}</ReactMarkdown>
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
              <div className="terminal-section">
                <div className="terminal-header">SEASON_{currentSeason.season}.CFG</div>
                <div className="terminal-row">
                  <span className="prompt">{"guest@league:~$"}</span>
                  <span className="command">describe season {currentSeason.season}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Teams: ${league.settings.num_teams}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Type: ${league.settings.type}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Playoff teams: ${league.settings.playoff_teams} (starting wk ${league.settings.playoff_week_start})`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Trade deadline: wk ${league.settings.trade_deadline_week}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Keepers: ${league.settings.max_keepers}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Roster: ${rosterDisplay}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> IR slots: ${league.settings.reserve_slots}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">{`> Draft date: ${draftDateCt}`}</span>
                </div>
                <div className="terminal-row">
                  <span className="output">
                    {`> Status: ${currentSeason.status} `}
                    <span className="cursor-blink">_</span>
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Connect / Footer */}
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
