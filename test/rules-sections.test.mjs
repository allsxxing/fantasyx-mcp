import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSections, sectionBullets } from "../src/lib/rules-sections.ts";

const SAMPLE = `# Title

Intro paragraph.

## LATEST SEASON DETAILS

- **Teams:** 10
- **Type:** Re-Draft

---

## TAGLINES

- One League. One Crown. One X.

**Swangin' and bangin'.**
`;

test("splitSections keys sections by normalized heading", () => {
  const sections = splitSections(SAMPLE);
  assert.ok(sections.has("LATEST SEASON DETAILS"));
  assert.ok(sections.has("TAGLINES"));
});

test("splitSections excludes the heading line and trailing hr from the body", () => {
  const body = splitSections(SAMPLE).get("LATEST SEASON DETAILS");
  assert.ok(!body.includes("## LATEST SEASON DETAILS"));
  assert.ok(!body.includes("---"));
  assert.ok(body.includes("**Teams:** 10"));
});

test("sectionBullets strips markdown emphasis and list markers", () => {
  const body = splitSections(SAMPLE).get("LATEST SEASON DETAILS");
  assert.deepEqual(sectionBullets(body), ["Teams: 10", "Type: Re-Draft"]);
});

test("sectionBullets returns an empty array for a section with no list", () => {
  assert.deepEqual(sectionBullets("Just prose here."), []);
});

test("splitSections returns an empty map for empty input", () => {
  assert.equal(splitSections("").size, 0);
});
