import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIcs, upcoming } from "../src/lib/ics.ts";

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Draft Day
DTSTART:20260906T220000Z
DTEND:20260907T010000Z
LOCATION:Sleeper app
DESCRIPTION:Snake draft\\, 90s per pick
END:VEVENT
BEGIN:VEVENT
SUMMARY:Trade Deadline (TBD)
DTSTART;VALUE=DATE:20261110
END:VEVENT
BEGIN:VEVENT
SUMMARY:Long descr
  iption test
DTSTART:20260101T000000Z
DESCRIPTION:First line
 continued on a folded line
END:VEVENT
END:VCALENDAR
`;

test("parseIcs extracts events sorted by start", () => {
  const events = parseIcs(SAMPLE);
  assert.equal(events.length, 3);
  assert.equal(events[0].summary, "Long descr iption test");
  assert.equal(events[1].summary, "Draft Day");
  assert.equal(events[2].summary, "Trade Deadline (TBD)");
});

test("parseIcs unescapes commas and preserves location/description", () => {
  const events = parseIcs(SAMPLE);
  const draft = events.find((e) => e.summary === "Draft Day");
  assert.ok(draft);
  assert.equal(draft.location, "Sleeper app");
  assert.equal(draft.description, "Snake draft, 90s per pick");
  assert.equal(draft.start, "2026-09-06T22:00:00Z");
  assert.equal(draft.allDay, false);
});

test("parseIcs unfolds continuation lines in SUMMARY and DESCRIPTION", () => {
  const events = parseIcs(SAMPLE);
  const folded = events.find((e) => e.start === "2026-01-01T00:00:00Z");
  assert.ok(folded);
  assert.equal(folded.description, "First linecontinued on a folded line");
});

test("parseIcs handles VALUE=DATE all-day events", () => {
  const events = parseIcs(SAMPLE);
  const tbd = events.find((e) => e.summary === "Trade Deadline (TBD)");
  assert.ok(tbd);
  assert.equal(tbd.allDay, true);
  assert.equal(tbd.start, "2026-11-10");
});

test("parseIcs returns an empty array for a calendar with no events", () => {
  const empty = parseIcs("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n");
  assert.deepEqual(empty, []);
});

test("parseIcs ignores malformed VEVENT blocks missing SUMMARY or DTSTART", () => {
  const broken = parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T000000Z\nEND:VEVENT\nEND:VCALENDAR\n");
  assert.deepEqual(broken, []);
});

test("upcoming filters out events before the given date", () => {
  const events = parseIcs(SAMPLE);
  const future = upcoming(events, new Date("2026-06-01T00:00:00Z"));
  assert.equal(future.length, 2);
  assert.ok(future.every((e) => e.start >= "2026-06-01"));
});
