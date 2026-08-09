import { getData, getDocument, manifest, requireData } from "@/lib/content";
import { RetroChrome } from "@/components/retro-chrome";

interface League {
  display_name: string;
  invite_url: string;
  season_chain: Array<{ season: string; status: string }>;
  settings: {
    num_teams: number;
    playoff_teams: number;
    waiver_budget_faab: number;
    max_keepers: number;
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
  note: string;
}

interface Dues {
  buy_in_base_usd: number;
  structure: string;
  multiplier: { status: string; options: string[] };
  payment_method: string;
}

interface Links {
  sleeper_invite: string;
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

  return (
    <>
      <RetroChrome />

      <header>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="logo">{league.display_name}</div>
          <nav className="nav-links">
            <a href="#champions">CHAMPIONS</a>
            <a href="#x-belt">X-BELT</a>
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
              {league.display_name}. Bylaws, the X Champion sabotage mechanic, dues, and season history —
              all queryable, all versioned.
            </p>
            <a href="#connect" className="btn-retro">
              CONNECT
            </a>
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
            <div className="stat-val">${league.settings.waiver_budget_faab}</div>
            <div className="stat-label">FAAB Budget</div>
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
            {seasons.map((season) => (
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
        <section className="terminal-section" id="x-belt">
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
        </section>

        {/* Rules strip */}
        {rulesMeta && rulesDoc && (
          <section id="rules" style={{ marginBottom: "100px" }}>
            <h2 className="section-title">Rules</h2>
            <div className="window-frame" style={{ padding: "20px" }}>
              <p style={{ color: "var(--accent-retro)", fontWeight: 700, marginBottom: "10px" }}>
                ⚠️ PROVISIONAL — {rulesMeta.version} ({rulesMeta.status})
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>{rulesMeta.note}</p>
            </div>
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
          <div style={{ textAlign: "right", maxWidth: "480px" }}>
            <p style={{ marginBottom: "10px" }}>
              <code>/api/mcp</code> — public, Streamable HTTP, no auth
            </p>
            <p style={{ marginBottom: "10px" }}>
              <code>/api/admin/mcp</code> — requires a bearer token
            </p>
            <p style={{ marginBottom: "20px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              <code>claude mcp add --transport http https://fantasyx-mcp.vercel.app/api/mcp</code>
            </p>
            <p style={{ marginBottom: "10px" }}>
              <a href={inviteUrl} style={{ color: "var(--text-primary)" }}>
                SLEEPER INVITE
              </a>
            </p>
            <p style={{ marginBottom: "20px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Dues: ${dues.buy_in_base_usd} base, {dues.structure.replace(/_/g, " ")} — multiplier{" "}
              {dues.multiplier.status.replace(/_/g, " ")}
            </p>
            <p className="copyright">LEAGUE FACTS ARE VERSIONED CONTENT. LIVE STANDINGS VIA SLEEPER.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
