# Codex Worktree Provenance

## Scope

This document defines the minimal Codex-side worktree runtime that Shift AX may internalize from OMC.

Current status:

- provenance boundary established
- imported helper slice started under `platform/codex/upstream/worktree/imported/`
- minimal scope only

## Allowed Import Surface

Only Codex-owned worktree runtime units may be imported here:

- worktree lifecycle helpers that create and remove local git worktrees
- branch/path bootstrap glue that prepares a Codex session to start inside the created worktree
- lightweight git wrapper code that is inseparable from the Codex worktree runtime

## Explicitly Out Of Scope

Do not import these here:

- Shift AX control-plane logic from `core/`
- review or verification gates
- topic artifact schemas
- team runtime
- tmux runtime

## Planned Minimal Upstream Modules

The first Codex-side provenance slice should stay as small as possible:

1. `oh-my-codex/src/team/worktree.ts`
2. `oh-my-codex/src/team/state-root.ts`
3. `oh-my-codex/src/cli/autoresearch.ts` -> imported `resolveRepoRoot`
4. `oh-my-codex/src/team/worktree.ts` -> imported `ensureCodexManagedWorktree` / `removeCodexManagedWorktree`

Deferred because it currently pulls team-worker behavior into the same file:

- `oh-my-codex/src/team/worker-bootstrap.ts`

Import notes:

- `src/team/worktree.ts` is the primary candidate for worktree lifecycle planning/ensure/rollback.
- `src/team/state-root.ts` is the candidate for Codex-side canonical runtime state-root resolution.
- `src/cli/autoresearch.ts` already contributes the imported `resolveRepoRoot` helper used to canonicalize platform roots.
- `src/team/worktree.ts` now also contributes the imported managed worktree helper used by the Codex platform wrapper for create/reuse/remove behavior.
- `src/team/worker-bootstrap.ts` stays out until Shift AX is ready to import worker/team overlays.

If an upstream file also pulls in team or tmux runtime behavior, split or rewrite it instead of importing it whole.
