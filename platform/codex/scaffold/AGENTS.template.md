# Shift AX Codex Bootstrap

You are running inside a Shift AX Codex build.

## Bootstrap Mode

- This build uses AGENTS.md bootstrap.
- Before planning or implementation, resolve context from {{BASE_CONTEXT_INDEX}}.
- If the base-context index is missing, interview the team about domain/policy context and persist it with `ax onboard-context` (interactive) or `ax onboard-context --input <file>` before continuing.
- Use `ax doctor` when setup, launcher availability, or topic state looks unhealthy.
- Use `ax resolve-context` before answering when relevant documents may exist.
- Use `ax run-request` to create the request-scoped topic/worktree, run the planning interview, write brainstorming/spec/plan artifacts plus `execution-handoff.json`, and pause at the human planning-review gate.
- Use `ax approve-plan` after the human reviewer signs off.
- If the reviewed plan requires shared policy or base-context doc changes, record them first with `ax sync-policy-context --topic <dir> --summary "<what changed>" [--path <doc>]... [--entry "Label -> path"]...`.
- Then resume with `ax run-request --topic <dir> --resume` for automatic review and commit. Use `--no-auto-commit` only when a human explicitly wants the final commit step held back.
- If downstream review or CI fails after the topic looked ready, use `ax react-feedback --topic <dir> --kind <review-changes-requested|ci-failed> --summary "<text>"` to reopen implementation with a file-backed reaction trail.
- Use `ax launch-execution --platform codex --topic <dir> [--task-id <id>] [--dry-run]` when you need the concrete Codex or tmux launch commands from `execution-handoff.json`.
- Use `ax topic-status --topic <dir>` when you need a compact summary of phase, review gate, execution state, and last failure.
- Use `ax topics-status [--root DIR] [--limit N]` when you need a compact multi-topic view without leaving the CLI.
- If a reviewed request hits a mandatory escalation trigger, persist that stop with `ax run-request --topic <dir> --resume --escalation <kind>:<summary>` and resume only after human review with `--clear-escalations`.
- Use `ax worktree-plan` to inspect the preferred branch/worktree path for the topic.
- Use `ax worktree-create` before implementation begins and `ax worktree-remove` when the topic worktree should be torn down.
- Worktree runtime provenance is tracked in `platform/codex/upstream/worktree/provenance.md`.
- Active imported worktree helpers currently include `resolveRepoRoot`, `ensureCodexManagedWorktree`, and `removeCodexManagedWorktree`.
- Use `ax review --run` before finalization and `ax finalize-commit` only after the review gate allows commit.
- Natural language is the primary user surface. Internal AX commands exist to support the flow, not replace the conversation.
- In Shift AX shell sessions, interpret `/onboard`, `/doctor`, `/request <text>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` and the same `$...` aliases as product-shell commands that map to the corresponding `ax` workflows.
- Native product-shell prompt files are installed under `.codex/prompts/` for: `onboard`, `request`, `doctor`, `status`, `topics`, `resume`, and `review`.
