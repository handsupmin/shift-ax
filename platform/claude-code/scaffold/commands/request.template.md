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
7. parse the `shift-ax run-request` JSON, read `planReviewBrief` or `<topic>/plan-review-brief.md`, and summarize the plan-review packet for the user
8. do not end after printing paths; ask the user only to reply with `1` approve/start implementation, `2` request plan changes, or `3` reject
9. when the user replies `1`, internally record approval with `shift-ax approve-plan`, then immediately resume with `shift-ax run-request --resume --platform claude-code`; do not show those internal commands unless automation fails and manual recovery is needed
10. when the user replies `2`, internally record changes requested, update the plan artifacts, and present the revised review packet again; do not ask the user to run Shift AX commands
11. when the user replies `3`, internally record the rejection and stop; do not ask the user to run Shift AX commands

Never skip context grounding or the planning/review gates.
