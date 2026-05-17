# Independent-Review Playbook

## Check
- Review only file-backed artifacts, not hidden conversation memory.
- Treat the implementation as someone else's code path: read request, resolved context, readiness, spec, plan, execution evidence, verification, and changed files.
- Confirm all upstream review lanes approve before finalization.

## Approve when
- Upstream lanes are approved.
- Plan review is approved and fingerprint-matched.
- Planning readiness is `ready`.
- The implementation worktree has changed files to review.
- `execution-state.json` is `completed` and every recorded execution task is `completed`.
- `workflow-state.json` records at least one verification command, and every recorded command passed.
- Execution and verification evidence are traceable to the reviewed plan.

## Request changes when
- Any upstream lane asks for changes.
- The worktree has no changed files, even if the plan looks reviewable.
- Execution state is missing, not completed, or taskless.
- Any execution task is `failed`, `timed_out`, or missing a completed status.
- Machine-readable verification evidence is missing or contains a failure.
- The clean-context review cannot explain why the change satisfies the reviewed request.
- Verification or changed-file evidence is missing, stale, or inconsistent.
