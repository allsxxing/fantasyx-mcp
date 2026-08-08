export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "4rem auto", padding: "0 1rem", lineHeight: 1.6 }}>
      <h1>🔟 FOR $10❌ — League HQ</h1>
      <p>
        This is a remote <strong>Model Context Protocol</strong> server for the Sleeper fantasy
        football league <strong>🔟 FOR $10❌</strong>. It has no browser UI — connect an MCP client.
      </p>
      <ul>
        <li>
          Public endpoint: <code>/api/mcp</code> (Streamable HTTP, no auth)
        </li>
        <li>
          Admin endpoint: <code>/api/admin/mcp</code> (requires a bearer token)
        </li>
      </ul>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        League facts are versioned content; live standings come from the public Sleeper API.
      </p>
    </main>
  );
}
