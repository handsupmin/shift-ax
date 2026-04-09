# Large Real-Repo Dogfooding — Support Memory / Context Layers

Date: 2026-04-09  
Branch: `codex/context-backlog`

## Goal

Dogfood the honcho/get-shit-done-derived support layers on large real repositories and confirm that:

1. `docs/base-context/index.md` remains the primary source of truth.
2. Support memory stays secondary to shared docs and reviewed artifacts.
3. Readable state, threads, pause-work, recall, entity-memory, and consolidation all work on real repository shapes.
4. Context pressure is surfaced instead of silently ignored.

## Repositories

| Repository | Shape | Size | Onboarding mode |
| --- | --- | ---: | --- |
| `oh-my-codex` | docs-heavy orchestration repo | 716 tracked files / 21 MB | `ax onboard-context --discover` |
| `agent-orchestrator` | docs-heavy app/runtime repo | 573 tracked files / 25 MB | `ax onboard-context --discover` |
| `cosmo-backend` | large service monorepo with sparse shared docs | 874 tracked files / 1.1 GB | `ax onboard-context --input ...` |

Each repo was tested in a temporary git worktree so the source repository stayed untouched.

## Commands exercised

For each repo, the dogfood flow executed:

- `ax onboard-context`
- `ax doctor`
- `ax build-context-bundle`
- `ax init-context`
- `ax context-health`
- `ax monitor-context`
- `ax bootstrap-topic`
- `ax checkpoint-context`
- `ax pause-work`
- `ax thread-save`
- `ax threads`
- `ax promote-thread`
- `ax team-preferences`
- `ax recall --scope repo`
- `ax entity-memory`
- `ax consolidate-memory`
- `ax refresh-state`

Temporary committed topics and decision-register entries were added inside each test worktree to exercise recall, entity views, and consolidation.

## Results

### 1. `oh-my-codex`

- Discovery onboarding created 4 base-context entries.
- `ax doctor` returned `ok`.
- Docs-first bundle selected shared docs before support recall.
- `ax context-health` returned `ok`.
- Repo recall returned:
  - 1 base-context match
  - 2 committed topic matches
  - 2 decision matches
- `ax promote-thread` wrote `support-thread.md` and did **not** inject support content into `brainstorm.md`.
- Consolidation returned one duplicate-decision suggestion plus usable glossary candidates such as `openclaw`, `release`, and `context`.

### 2. `agent-orchestrator`

- Discovery onboarding created 2 base-context entries.
- `ax doctor` returned `ok`.
- Docs-first bundle selected `Project-Based Dashboard Architecture`.
- `ax context-health` returned `critical`.
  - This was the expected and desired result: the selected architecture doc alone exceeded the compact bundle budget.
  - Shift AX surfaced context pressure instead of silently pretending the bundle was safe.
- Repo recall returned:
  - 1 base-context match
  - 2 committed topic matches
  - 2 decision matches
- `ax promote-thread` again wrote `support-thread.md` without polluting `brainstorm.md`.
- Consolidation returned usable glossary candidates such as `dashboard`, `observability`, and `routing`.

### 3. `cosmo-backend`

- Manual onboarding created 5 shared docs copied into `docs/base-context/`.
- `ax doctor` returned `ok`.
- Docs-first bundle selected service-level shared docs such as:
  - `Gas Fuel Service Overview`
  - `Transaction Worker Overview`
  - `API Service Overview`
  - `Indexer Overview`
- `ax context-health` returned `ok`.
- Repo recall returned:
  - 1 base-context match
  - 2 committed topic matches
  - 2 decision matches
- `ax entity-memory --entity transaction` returned matching decisions, threads, and topics.
- Consolidation returned usable glossary candidates such as `rollback` and `transaction-worker`.

## Key checks

### Docs-first stayed intact

- Every repo produced a base-context bundle first.
- Repo recall still returned `base_context` separately from topics and decisions.
- `ax doctor` stayed green only after the base-context index and linked docs existed.

### Support layers stayed secondary

- `promote-thread` created `support-thread.md` for all three repos.
- `brainstorm.md` remained free of imported thread content in all three repos.

### Context pressure was visible

- `agent-orchestrator` correctly produced `critical` context health because the selected architecture doc overflowed the compact budget.
- The support layer warned the operator to split or narrow the work instead of hiding the problem.

## Dogfood-driven fix

Large-repo dogfooding exposed noisy glossary candidates during `ax consolidate-memory`.  
Examples from the first pass included generic junk such as `Thread` and malformed cross-line fragments.

This branch was updated to:

- extract glossary candidates line-by-line
- ignore thread/summary metadata noise
- prefer meaningful long tokens such as `openclaw`, `dashboard`, `routing`, and `rollback`

The updated consolidation behavior was rerun on the same real repos and produced cleaner results.

## Verdict

The support-memory/context backlog behaves correctly on large real repositories:

- docs-first precedence held
- support memory stayed secondary
- context pressure surfaced correctly
- readable state / handoff / threads / recall / entity-memory / consolidation all worked on real repo shapes

The one quality issue surfaced during dogfooding (glossary candidate noise) was fixed in this branch and re-verified.
