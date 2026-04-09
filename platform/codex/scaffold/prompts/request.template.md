---
description: Start a new Shift AX request-to-commit flow.
argument_hint: "<request>"
---

Treat everything after this command as the raw request text.

If no request text was provided, ask for it before doing anything else.

Then:

1. keep docs-first grounding
2. bootstrap the request with `ax run-request --request "<request>"`
3. explain the resulting topic path and that the workflow pauses at human plan review

Never skip context grounding or the planning/review gates.
