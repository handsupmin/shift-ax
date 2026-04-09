# Scripts

The `scripts/` directory is for top-level Shift AX entrypoints and operator-facing automation commands.

Currently implemented:

- `ax.ts`
- `ax-shell.ts`
- `install-global.sh`
- `ax-bootstrap-topic.ts`
- `ax-resolve-context.ts`
- `ax-review.ts`
- `ax-worktree-plan.ts`
- `ax-worktree-create.ts`
- `ax-worktree-remove.ts`
- `ax-onboard-context.ts`
- `ax-doctor.ts`
- `ax-run-request.ts`
- `ax-approve-plan.ts`
- `ax-sync-policy-context.ts`
- `ax-react-feedback.ts`
- `ax-finalize-commit.ts`
- `ax-launch-execution.ts`
- `ax-topic-status.ts`
- `ax-topics-status.ts`
- `ax-platform-manifest.ts`
- `ax-bootstrap-assets.ts`
- `ax-scaffold-build.ts`

Current request-to-commit behavior:

- `ax --codex`, `ax --claude-code`, or plain `ax` now open a conversational platform shell. On first run, if onboarding artifacts are missing, Shift AX opens the matching Codex or Claude Code session first and performs guided onboarding inside that platform conversation instead of using a separate readline questionnaire.
- Inside that shell, the agent is expected to understand `/onboard`, `$onboard`, `/doctor`, `/request <text>`, `/status`, `/topics`, `/resume <topic>`, and `/review <topic>` as Shift AX product-shell commands.
- `ax onboard-context` still exists for explicit scripted or manual onboarding, but the preferred first-run UX is now in-shell onboarding through the platform wrapper.
- `scripts/install-global.sh` is the one-command installer used by the public README and setup docs for global npm installation.
- `ax onboard-context` now supports a guided interactive interview by default and still accepts `--input <file>` for scripted onboarding. It writes tracked domain/policy docs, regenerates `docs/base-context/index.md`, and persists the shared engineering profile.
- `ax doctor [--root <dir>] [--topic <dir>] [--platform codex|claude-code]` prints a compact health report for the repo, base-context docs, shared profile, topic state, and optional launcher readiness.
- `ax run-request --request <text>` bootstraps a topic/worktree, resolves base context, runs an interactive planning interview by default, writes brainstorming/spec/plan artifacts plus `execution-handoff.json`, and pauses at the human planning-review gate.
- `ax approve-plan --topic <dir> --reviewer <name> --decision approve|reject` records the human planning-review decision and an approved-plan fingerprint. If planning identified shared policy/base-context changes, the workflow now pauses in a dedicated policy-sync gate before implementation starts.
- `ax sync-policy-context --topic <dir> --summary "<text>" [--path <doc>]... [--entry "Label -> path"]...` records that required shared policy/context docs were updated and, when needed, merges new entries into the base-context index before implementation resumes.
- `ax react-feedback --topic <dir> --kind <review-changes-requested|ci-failed> --summary "<text>"` reopens implementation when downstream review or CI feedback says the topic must go back to work.
- `ax run-request --topic <dir> --resume` resumes after approval, reruns review aggregation, auto-generates a Lore-compatible commit message artifact, and auto-commits by default once review passes. Use `--no-auto-commit` to stop at commit-ready for manual inspection. It also accepts `--escalation <kind>:<summary>` / `--clear-escalations` to pause or resume around the three mandatory human-escalation triggers.
- `ax finalize-commit --topic <dir>` validates or auto-generates the Lore commit message, verifies the aggregate review gate allows commit, and writes the local commit state artifact.
- `ax launch-execution --platform <codex|claude-code> --topic <dir> [--task-id <id>] [--dry-run]` materializes execution prompts from `execution-handoff.json` and returns or launches the concrete Codex / Claude / tmux commands for each task.
- `ax topic-status --topic <dir>` prints a compact status summary for the topic's current phase, review state, execution state, policy-sync gate, and latest lifecycle/reaction records.
- `ax topics-status [--root <dir>] [--limit N]` prints a compact multi-topic list for lightweight supervision without requiring a separate dashboard.
- `ax decisions --query "<text>" [--active-at YYYY-MM-DD] [--limit N]` can now act as a ranked decision-memory search and includes linked source-topic summaries when they are available.

Current review behavior:

- `ax review --topic <dir>` reads existing verdicts and aggregates them
- `ax review --topic <dir> --run` executes the built-in review lanes, writes per-lane verdict files, writes `review/aggregate.json`, and writes `review/summary.md`

Current topic/worktree behavior:

- `ax worktree-plan --topic <dir>` calculates and writes the current topic's preferred worktree plan to `worktree-plan.json`
- `ax worktree-create --topic <dir>` creates a local git worktree from the topic plan and writes `worktree-state.json`
- `ax worktree-remove --topic <dir>` removes the local git worktree and updates `worktree-state.json`

Current adapter/debug behavior:

- `ax platform-manifest --platform codex|claude-code` prints the current platform build manifest used by Shift AX adapters
- `ax bootstrap-assets --platform codex|claude-code` prints the bootstrap assets for a platform build without writing files
- `ax scaffold-build --platform codex|claude-code` writes bootstrap scaffold files into a target root

These commands should optimize for teams that are new to AX and should prefer safe defaults over maximum flexibility.
