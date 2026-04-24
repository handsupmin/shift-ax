---
description: Start a new Shift AX request-to-commit flow.
argument-hint: "<request>"
---

Treat everything after this command as the raw request text.

If no request text was provided, ask for it before doing anything else.

Then:

1. resolve context from `{{GLOBAL_CONTEXT_INDEX}}` first
2. if the request contains unfamiliar domain terms, repository nicknames, workflow labels, policy names, or acronyms, run additional `shift-ax resolve-context --root "$PWD" --query "<term>"` checks before grepping code
3. if the global index is missing, stop and tell the user onboarding should come first because accuracy will drop
4. ask whether they want to continue anyway
5. only if they explicitly agree, bootstrap with `shift-ax run-request --request "$ARGUMENTS" --allow-missing-global-context`
6. otherwise bootstrap with `shift-ax run-request --request "$ARGUMENTS"`
7. explain the resulting topic path and that the workflow pauses at human plan review

Never skip context grounding or the planning/review gates.
