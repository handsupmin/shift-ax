---
description: Resume an approved Shift AX topic.
argument_hint: "<topic-dir> [--verify-command <cmd> ...]"
---

Treat the first argument as the topic directory.

Resume with:

`ax run-request --topic <topic-dir> --resume`

If extra verification commands are given, append them as `--verify-command`.

Explain whether the topic is blocked by escalation or policy sync if resume cannot continue.
