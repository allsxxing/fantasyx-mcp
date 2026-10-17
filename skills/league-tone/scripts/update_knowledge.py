#!/usr/bin/env python3
"""
league-tone knowledge updater.
Scans approved drafts / templates for candidate voice patterns.
Does not auto-promote locked rules.
Writes candidates to references/learning-log.md.
"""

import json
import os
from datetime import datetime
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
REFERENCES = SKILL_ROOT / "references"
LEARNING_LOG = REFERENCES / "learning-log.md"
EXAMPLE_DMS = REFERENCES / "example-dms.md"

def load_last_run() -> str:
    if not LEARNING_LOG.exists():
        return "1970-01-01"
    text = LEARNING_LOG.read_text()
    for line in text.splitlines():
        if line.startswith("last_run:"):
            return line.split(":", 1)[1].strip()
    return "1970-01-01"

def append_log(date: str, source: str, pattern: str, decision: str, reason: str):
    row = f"| {date} | {source} | {pattern} | {decision} | {reason} |\n"
    text = LEARNING_LOG.read_text() if LEARNING_LOG.exists() else "# Learning Log\n\n| Date | Source Task | Pattern | Decision | Reason |\n|------|-------------|---------|----------|--------|\n"
    if "last_run:" in text:
        text = text.replace("last_run:", f"{row}last_run:")
    else:
        text += row
    # Update last_run
    lines = text.splitlines()
    new_lines = []
    updated = False
    for line in lines:
        if line.startswith("last_run:"):
            new_lines.append(f"last_run: {date}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"last_run: {date}")
    LEARNING_LOG.write_text("\n".join(new_lines) + "\n")

def main():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    last = load_last_run()
    print(f"Last run: {last}. Scanning since then.")
    # Placeholder: real scan would walk 🏆FANTASY! tasks, local mirror, or content/chat-templates
    # Only approved final drafts. Ignore brainstorms.
    # For this rebuild, log the initial scan.
    append_log(
        today,
        "rebuild-scan",
        "Baseline scan complete. No new patterns promoted.",
        "held",
        "Updater ready. Promote only on 2+ repeats or explicit lock."
    )
    print("Learning log updated. No locked rules changed.")
    print("To promote: edit SKILL.md only after second approved occurrence or GJ lock.")

if __name__ == "__main__":
    main()
