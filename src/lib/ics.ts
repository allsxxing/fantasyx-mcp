// Dependency-free RFC-5545 (ICS) VEVENT reader. We only ever need to *read* a public
// calendar's events for display — pulling in a full ICS library for that is overkill and
// this file stays small enough to unit test directly (see test/ics.test.mjs).

export interface CalendarEvent {
  summary: string;
  /** ISO 8601 start, or the raw DTSTART value if it could not be parsed as a date. */
  start: string;
  end?: string;
  location?: string;
  description?: string;
  allDay: boolean;
}

/** Unfold RFC-5545 continuation lines: a line starting with a space/tab continues the previous line. */
function unfoldLines(raw: string): string[] {
  const lines = raw.split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Parse a DTSTART/DTEND value (with optional VALUE=DATE / TZID params already stripped from the key) into ISO or pass through raw. */
function parseDate(value: string, isDateOnly: boolean): string {
  const v = value.trim();
  if (isDateOnly && /^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`;
  }
  return v;
}

function splitProperty(line: string): { key: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const [key, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq !== -1) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { key: key.toUpperCase(), params, value };
}

/** Parse the VEVENT blocks out of raw ICS text, sorted by start date/time ascending. */
export function parseIcs(raw: string): CalendarEvent[] {
  const lines = unfoldLines(raw);
  const events: CalendarEvent[] = [];
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.summary && current.start) {
        events.push({
          summary: current.summary,
          start: current.start,
          end: current.end,
          location: current.location,
          description: current.description,
          allDay: current.allDay ?? false,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const prop = splitProperty(line);
    if (!prop) continue;

    switch (prop.key) {
      case "SUMMARY":
        current.summary = unescapeText(prop.value);
        break;
      case "LOCATION":
        current.location = unescapeText(prop.value);
        break;
      case "DESCRIPTION":
        current.description = unescapeText(prop.value);
        break;
      case "DTSTART": {
        const isDateOnly = prop.params.VALUE === "DATE";
        current.allDay = isDateOnly;
        current.start = parseDate(prop.value, isDateOnly);
        break;
      }
      case "DTEND": {
        const isDateOnly = prop.params.VALUE === "DATE";
        current.end = parseDate(prop.value, isDateOnly);
        break;
      }
      default:
        break;
    }
  }

  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** Only events starting today (UTC calendar day) or later. */
export function upcoming(events: CalendarEvent[], now: Date = new Date()): CalendarEvent[] {
  const todayKey = now.toISOString().slice(0, 10);
  return events.filter((e) => e.start.slice(0, 10) >= todayKey);
}
