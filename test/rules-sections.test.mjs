import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitSections,
  sectionBullets,
  stripHeadingNumbers,
  promoteBoldLabelsToHeadings,
  removeSections,
} from "../src/lib/rules-sections.ts";

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

test("stripHeadingNumbers removes ordinal prefixes from headings only", () => {
  const input = "### 1. BUY-IN MULTIPLIER\n\n1. Not a heading, an ordered list item.\n";
  const result = stripHeadingNumbers(input);
  assert.ok(result.includes("### BUY-IN MULTIPLIER"));
  assert.ok(result.includes("1. Not a heading, an ordered list item."));
});

test("promoteBoldLabelsToHeadings converts standalone bold labels to uppercase h4s", () => {
  const input = "**Declaration Rule:**\n\n- Must declare by Friday.\n\n**Title Transfer:**\n";
  const result = promoteBoldLabelsToHeadings(input, ["Declaration Rule", "Title Transfer"]);
  assert.ok(result.includes("#### DECLARATION RULE:"));
  assert.ok(result.includes("#### TITLE TRANSFER:"));
  assert.ok(!result.includes("**Declaration Rule:**"));
});

test("removeSections drops a named section and stops at the next heading", () => {
  const result = removeSections(SAMPLE, ["TAGLINES"]);
  assert.ok(!result.includes("TAGLINES"));
  assert.ok(!result.includes("One League. One Crown. One X."));
  assert.ok(result.includes("## LATEST SEASON DETAILS"));
});
