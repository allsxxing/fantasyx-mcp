import type { ReactNode } from "react";
import { Space_Mono, Syne } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

const syne = Syne({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata = {
  title: "FantasyX-MCP — 🏈10 FOR $10❌ League HQ",
  description: "Remote MCP server: League HQ for the Sleeper league 🏈10 FOR $10❌.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} ${syne.variable}`}>{children}</body>
    </html>
  );
}
