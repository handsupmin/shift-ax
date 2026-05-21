---
description: Start a new Shift AX request-to-commit flow.
argument_hint: "<request>"
---

Treat everything after this command as the raw request text.

If no request text was provided, ask for it before doing anything else.

Then:

1. resolve context from `{{GLOBAL_CONTEXT_INDEX}}` first
2. if the request contains unfamiliar domain terms, repository nicknames, workflow labels, policy names, or acronyms, run additional `shift-ax resolve-context --root "$PWD" --query "<term>"` checks before grepping code
3. if the global index is missing, stop and tell the user onboarding should come first because accuracy will drop
4. ask whether they want to continue anyway
5. before bootstrapping, inspect the request evidence enough to make the plan reviewable:
   - read any local files, specs, PRDs, screenshots converted to text, or paths named in the request
   - treat later user Q&A or explicit request text as higher priority than background PRD/reference text
   - inspect the target repository structure and existing patterns enough to name likely files, APIs, models, tests, and verification commands
   - identify ambiguity questions, risky side effects, data/schema/worker/admin/security surfaces, and out-of-scope boundaries
6. perform an explicit ambiguity pass before `shift-ax run-request`:
   - list the key unknowns you checked
   - mark each as resolved by request text, global context, repo evidence, or user Q&A
   - if no clarification is needed, say why before moving to planning
   - if core answers are still missing, ask concise clarification questions before running `shift-ax run-request`; do not create placeholder artifacts
7. write temporary planning artifacts and pass them to `shift-ax run-request` with `--brainstorm-file`, `--spec-file`, and `--plan-file`; do not run a bare non-interactive `shift-ax run-request --request "<request>"` unless a real interactive planning interview is happening
8. the generated plan must include concrete acceptance criteria, constraints, out-of-scope items, repo-by-repo likely files, verification commands, execution tasks, and a "risky / needs attention" section covering data integrity, migrations, workers, queues, permissions, destructive operations, and rollback/deploy concerns when relevant
9. only if they explicitly agree to missing global context, include `--allow-missing-global-context`; otherwise do not include it
10. parse the `shift-ax run-request` JSON, read `planReviewBrief` or `<topic>/plan-review-brief.md`, and present the "Chat Approval Packet" / localized chat packet in enough detail that a reviewer can approve or reject from the chat alone
    - include the ambiguity/clarification decision
    - include constraints, out-of-scope boundaries, acceptance criteria, likely files/surfaces, verification, risks/side effects, and execution tasks
    - do not replace the packet with only paths, a short headline summary, or a tiny bullet list
11. if the brief contains fallback text like "No acceptance criteria", "No likely files", or readiness blockers, treat it as not approval-ready and request plan changes/clarification instead of asking for approval
12. do not end after printing paths; ask the user only to reply with `1`, `2`, or `3` using `planReviewBrief.review_prompt` and `planReviewBrief.response_options` labels in the user's language
13. when the user replies `1`, internally record approval with `shift-ax approve-plan`, then immediately resume with `shift-ax run-request --resume --platform codex`; continue until implementation, verification, review, and commit either complete or hit a concrete blocker; do not show those internal commands unless automation fails and manual recovery is needed
14. when the user replies `2`, internally record changes requested, update the plan artifacts, and present the revised review packet again; do not ask the user to run Shift AX commands
15. when the user replies `3`, internally record the rejection and stop; do not ask the user to run Shift AX commands

Never skip context grounding or the planning/review gates.
