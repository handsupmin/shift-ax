# Shift AX Claude Code SessionStart Bootstrap

This build is expected to use SessionStart hook-driven context injection.

## Hook Intent

- SessionStart should inject Shift AX bootstrap context.
- Before planning or implementation, resolve context from {{BASE_CONTEXT_INDEX}}.
- If the base-context index is missing, interview the team about domain/policy context and persist it with `ax onboard-context` (interactive) or `ax onboard-context --input <file>` before continuing.
- Use `ax resolve-context` before answering when relevant documents may exist.
- Use `ax run-request` to create the request-scoped topic/worktree, write brainstorming/spec/plan artifacts, and pause at the human planning-review gate.
- Use `ax approve-plan` after the human reviewer signs off, then resume with `ax run-request --topic <dir> --resume`.
- If a reviewed request hits a mandatory escalation trigger, persist that stop with `ax run-request --topic <dir> --resume --escalation <kind>:<summary>` and resume only after human review with `--clear-escalations`.
- Use `ax worktree-plan` to inspect the preferred branch/worktree path for the topic.
- Use `ax worktree-create` before implementation begins and `ax worktree-remove` when the topic worktree should be torn down.
- Worktree runtime provenance is tracked in `platform/claude-code/upstream/worktree/provenance.md`.
- Active imported worktree helpers currently include `getWorktreeRoot`, `createClaudeManagedWorktree`, and `removeClaudeManagedWorktree`.
- Use `ax review --run` before finalization and `ax finalize-commit` only after the review gate allows commit.
- Natural language is the primary user surface. Internal AX commands exist to support the flow, not replace the conversation.
