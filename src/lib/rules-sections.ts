// Pure helpers for extracting presentation slices out of the generated rules.md body.
// rules.md is the single source of truth (see CLAUDE.md → Content ownership); these
// functions never mutate it, they only read named sections for display.

/**
 * Split a Markdown body into a map of heading text → section body.
 * Keys are the heading text with leading "#" markers, numeric prefixes ("2. "),
 * and surrounding whitespace removed. Later duplicate headings do not overwrite earlier ones.
 */
export function splitSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  if (!body.trim()) return sections;

  const lines = body.split("\n");
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (currentKey === null) return;
    const text = buffer.join("\n").replace(/\n*^---\s*$/gm, "").trim();
    if (!sections.has(currentKey)) sections.set(currentKey, text);
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flush();
      currentKey = heading[1].replace(/^\d+\.\s*/, "").trim();
      buffer = [];
    } else if (currentKey !== null) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Extract top-level list items from a section body as plain text,
 * stripping list markers and Markdown emphasis. Returns [] when there is no list.
 */
export function sectionBullets(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\\([<>])/g, "$1")
        .trim(),
    )
    .filter(Boolean);
}

/** Convenience: look up one section body, or "" when absent. */
export function getSection(body: string, heading: string): string {
  return splitSections(body).get(heading) ?? "";
}

/** Strip leading ordinal prefixes ("1. ", "2. ") from Markdown heading lines only. */
export function stripHeadingNumbers(markdown: string): string {
  return markdown.replace(/^(#{1,6})\s*\d+\.\s*/gm, "$1 ");
}

/**
 * Promote standalone bold labels (e.g. "**Declaration Rule:**" alone on its own
 * line) into level-4 headings, upper-cased, so they render as visual sub-headers
 * instead of inline bold text.
 */
export function promoteBoldLabelsToHeadings(markdown: string, labels: string[]): string {
  if (labels.length === 0) return markdown;
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`^\\*\\*(${escaped.join("|")}):\\*\\*$`, "gm");
  return markdown.replace(pattern, (_match, label: string) => `#### ${label.toUpperCase()}:`);
}

/**
 * Remove one or more named sections (heading + everything until the next
 * heading of equal or shallower depth) from a Markdown body. Heading text is
 * normalized the same way splitSections keys sections, so "## TAGLINES" matches
 * an exclusion of "TAGLINES".
 */
export function removeSections(markdown: string, excludeTitles: string[]): string {
  const exclude = new Set(excludeTitles.map((title) => title.replace(/^\d+\.\s*/, "").trim()));
  if (exclude.size === 0) return markdown;

  const lines = markdown.split("\n");
  const kept: string[] = [];
  let skipping = false;
  let skipLevel = 0;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/^\d+\.\s*/, "").trim();
      if (skipping && level <= skipLevel) {
        skipping = false;
      }
      if (!skipping && exclude.has(title)) {
        skipping = true;
        skipLevel = level;
        continue;
      }
    }
    if (skipping) continue;
    kept.push(line);
  }

  return kept.join("\n");
}
