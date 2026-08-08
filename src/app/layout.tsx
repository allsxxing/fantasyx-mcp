import type { ReactNode } from "react";

export const metadata = {
  title: "FantasyX-MCP — 🔟 FOR $10❌ League HQ",
  description: "Remote MCP server: League HQ for the Sleeper league 🔟 FOR $10❌.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
