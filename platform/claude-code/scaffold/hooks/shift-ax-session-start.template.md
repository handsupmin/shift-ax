# Shift AX Claude Code SessionStart Bootstrap

This build is expected to use SessionStart hook-driven context injection.

## Hook Intent

- SessionStart should inject Shift AX bootstrap context.
- Before planning or implementation, resolve context from {{GLOBAL_CONTEXT_INDEX}}.
- If the global index is missing, recommend `/onboard` before `/request`. Do not pretend the missing context does not matter.
- Use `shift-ax doctor` when setup, launcher availability, or topic state looks unhealthy.
- Use `shift-ax resolve-context` before answering when relevant documents may exist.
- Use `shift-ax run-request` to create the request-scoped topic/worktree, run the planning interview, write brainstorming/spec/plan artifacts plus `execution-handoff.json`, and pause at the human planning-review gate.
- Use `shift-ax approve-plan` after the human reviewer signs off.
- If the reviewed plan requires shared policy or base-context doc changes, record them first with `shift-ax sync-policy-context --topic <dir> --summary "<what changed>" [--path <doc>]... [--entry "Label -> path"]...`.
- Then resume with `shift-ax run-request --topic <dir> --resume` for automatic review and commit. Use `--no-auto-commit` only when a human explicitly wants the final commit step held back.
- If downstream review or CI fails after the topic looked ready, use `shift-ax react-feedback --topic <dir> --kind <review-changes-requested|ci-failed> --summary "<text>"` to reopen implementation with a file-backed reaction trail.
- Use `shift-ax launch-execution --platform claude-code --topic <dir> [--task-id <id>] [--dry-run]` when you need the concrete Claude or tmux launch commands from `execution-handoff.json`.
- Use `shift-ax topic-status --topic <dir>` when you need a compact summary of phase, review gate, execution state, and last failure.
- Use `shift-ax topics-status [--root DIR] [--limit N]` when you need a compact multi-topic view without leaving the CLI.
- If a reviewed request hits a mandatory escalation trigger, persist that stop with `shift-ax run-request --topic <dir> --resume --escalation <kind>:<summary>` and resume only after human review with `--clear-escalations`.
- Use `shift-ax worktree-plan` to inspect the preferred branch/worktree path for the topic.
- Use `shift-ax worktree-create` before implementation begins and `shift-ax worktree-remove` when the topic worktree should be torn down.
- Worktree runtime provenance is tracked in `platform/claude-code/upstream/worktree/provenance.md`.
- Active imported worktree helpers currently include `getWorktreeRoot`, `createClaudeManagedWorktree`, and `removeClaudeManagedWorktree`.
- Use `shift-ax review --run` before finalization and `shift-ax finalize-commit` only after the review gate allows commit.
- Natural language is the primary user surface. Internal AX commands exist to support the flow, not replace the conversation.
- In Shift AX Claude Code sessions, use `/onboard`, `/request <text>`, `/export-context`, `/doctor`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` as the primary visible commands. `$...` aliases may mirror them when useful.
- Native product-shell command files are installed under `.claude/commands/` for: `onboard`, `request`, `export-context`, `doctor`, `status`, `topics`, `resume`, and `review`.
- Treat `$request <text>` as the explicit alias for starting a new request-to-commit flow inside the session.
