---
description: Resume an approved Shift AX topic.
argument-hint: "<topic-dir> [--verify-command <cmd> ...]"
---

Treat the first argument as the topic directory.

Resume with:

`shift-ax run-request --topic $ARGUMENTS --resume`

If the resumed review passes, this path auto-writes the localized lore commit message and creates the local git commit unless `--no-auto-commit` was requested.

Explain whether the topic is blocked by escalation or policy sync if resume cannot continue.
