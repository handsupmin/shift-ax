# Scripts

The `scripts/` directory is for top-level Shift AX entrypoints and operator-facing automation commands.

Currently implemented:

- `ax.ts`
- `ax-bootstrap-topic.ts`
- `ax-resolve-context.ts`
- `ax-review.ts`
- `ax-worktree-plan.ts`
- `ax-worktree-create.ts`
- `ax-worktree-remove.ts`
- `ax-onboard-context.ts`
- `ax-run-request.ts`
- `ax-approve-plan.ts`
- `ax-finalize-commit.ts`
- `ax-platform-manifest.ts`
- `ax-bootstrap-assets.ts`
- `ax-scaffold-build.ts`

Current request-to-commit behavior:

- `ax onboard-context` now supports a guided interactive interview by default and still accepts `--input <file>` for scripted onboarding. It writes tracked domain/policy docs, regenerates `docs/base-context/index.md`, and persists the shared engineering profile.
- `ax run-request --request <text>` bootstraps a topic/worktree, resolves base context, writes brainstorming/spec/plan artifacts, and pauses at the human planning-review gate.
- `ax approve-plan --topic <dir> --reviewer <name> --decision approve|reject` records the human planning-review decision and an approved-plan fingerprint.
- `ax run-request --topic <dir> --resume` resumes after approval, reruns review aggregation, auto-generates a Lore-compatible commit message artifact when the topic becomes commit-ready, and accepts `--escalation <kind>:<summary>` / `--clear-escalations` to pause or resume around the three mandatory human-escalation triggers.
- `ax finalize-commit --topic <dir>` validates or auto-generates the Lore commit message, verifies the aggregate review gate allows commit, and writes the local commit state artifact.

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
