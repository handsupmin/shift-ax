---
description: Start a new Shift AX request-to-commit flow.
argument_hint: "<request>"
---

Treat everything after this command as the raw request text.

If no request text was provided, ask for it before doing anything else.

Then:

1. resolve context from `{{GLOBAL_CONTEXT_INDEX}}` first
2. if the global index is missing, stop and tell the user onboarding should come first because accuracy will drop
3. ask whether they want to continue anyway
4. before bootstrapping, inspect request evidence enough to make the plan reviewable: read named local files, inspect target repo structure and existing patterns, resolve unfamiliar terms, and identify ambiguity questions plus risky data/schema/worker/admin/security side effects
5. perform an explicit ambiguity pass before `shift-ax run-request`: list the key unknowns you checked, mark each as resolved by request text/global context/repo evidence/user Q&A, say why no clarification is needed when the prompt is complete, and ask concise clarification questions when core answers are still missing; do not create placeholder artifacts
6. write temporary brainstorm/spec/plan files and pass them with `--brainstorm-file`, `--spec-file`, and `--plan-file`; do not run a bare non-interactive `shift-ax run-request --request "<request>"` unless a real interactive planning interview is happening
7. the plan must include concrete acceptance criteria, constraints, out-of-scope items, repo-by-repo likely files, verification commands, execution tasks, and a "risky / needs attention" section
8. only if they explicitly agree to missing global context, include `--allow-missing-global-context`; otherwise do not include it
9. parse the `shift-ax run-request` JSON, read `planReviewBrief` or `<topic>/plan-review-brief.md`, and present the localized chat approval packet in enough detail that a reviewer can approve or reject from the chat alone; include ambiguity decision, constraints, out-of-scope boundaries, acceptance criteria, likely files/surfaces, verification, risks/side effects, and execution tasks instead of only paths or a tiny summary
10. if the brief contains fallback text like "No acceptance criteria", "No likely files", or readiness blockers, treat it as not approval-ready and request plan changes/clarification instead of asking for approval
11. do not end after printing paths; ask the user only to reply with `1`, `2`, or `3` using `planReviewBrief.review_prompt` and `planReviewBrief.response_options` labels in the user's language
12. when the user replies `1`, internally record approval with `shift-ax approve-plan`, then immediately resume with `shift-ax run-request --resume --platform codex`; continue until implementation, verification, review, and commit either complete or hit a concrete blocker; do not show those internal commands unless automation fails and manual recovery is needed
13. when the user replies `2`, internally record changes requested, update the plan artifacts, and present the revised review packet again; do not ask the user to run Shift AX commands
14. when the user replies `3`, internally record the rejection and stop; do not ask the user to run Shift AX commands

Never skip context grounding or the planning/review gates.
