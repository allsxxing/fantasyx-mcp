"use client";

import { useState } from "react";

type TabKey = "sleeper" | "dues" | "mcp";

interface ConnectTabsProps {
  inviteUrl: string;
  duesUrl: string;
  buyIn: number;
  structure: string;
  multiplierStatus: string;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "sleeper", label: "CONNECT SLEEPER" },
  { key: "dues", label: "PAY DUES" },
  { key: "mcp", label: "MCP ENDPOINTS" },
];

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "fantasyx": {
      "type": "http",
      "url": "https://fantasyx.allsxxing.com/api/mcp"
    }
  }
}`;

const MCP_CURL = `claude mcp add --transport http https://fantasyx.allsxxing.com/api/mcp

curl -N -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \\
  https://fantasyx.allsxxing.com/api/mcp`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="copy-btn" onClick={handleCopy}>
      {copied ? "COPIED!" : "COPY"}
    </button>
  );
}

export function ConnectTabs({ inviteUrl, duesUrl, buyIn, structure, multiplierStatus }: ConnectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("sleeper");

  return (
    <div className="connect-tabs">
      <div className="tab-buttons">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-btn${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sleeper" && (
        <div className="tab-panel">
          <div className="btn-group" style={{ marginBottom: "20px" }}>
            <a href={inviteUrl} className="btn-retro">
              JOIN ON SLEEPER
            </a>
          </div>
          <ol style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li>Click JOIN ON SLEEPER above to open the league invite.</li>
            <li>Install the Sleeper app or sign in on the web.</li>
            <li>Accept the invite and pick your team name.</li>
            <li>You&apos;re in — the draft, rosters, and matchups sync automatically.</li>
          </ol>
        </div>
      )}

      {activeTab === "dues" && (
        <div className="tab-panel">
          <div className="btn-group" style={{ marginBottom: "20px" }}>
            <a href={duesUrl} className="btn-retro btn-retro--ghost">
              PAY DUES
            </a>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Dues: ${buyIn} base, {structure.replace(/_/g, " ")} — multiplier {multiplierStatus.replace(/_/g, " ")}
          </p>
        </div>
      )}

      {activeTab === "mcp" && (
        <div className="tab-panel">
          <p style={{ marginBottom: "10px" }}>
            <strong>Option A — MCP config (copy-paste)</strong>
          </p>
          <div className="code-block-wrap">
            <pre style={{ textAlign: "left", overflowX: "auto" }}>
              <code>{MCP_CONFIG_JSON}</code>
            </pre>
            <CopyButton text={MCP_CONFIG_JSON} />
          </div>

          <p style={{ margin: "20px 0 10px" }}>
            <strong>Option B — Streamable HTTP (curl)</strong>
          </p>
          <div className="code-block-wrap">
            <pre style={{ textAlign: "left", overflowX: "auto" }}>
              <code>{MCP_CURL}</code>
            </pre>
            <CopyButton text={MCP_CURL} />
          </div>

          <p style={{ marginTop: "20px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            <code>/api/admin/mcp</code> — requires a bearer token
          </p>
        </div>
      )}
    </div>
  );
}
