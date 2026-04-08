# Claude Code Worktree Provenance

## Scope

This document defines the minimal Claude Code-side worktree runtime that Shift AX may internalize from OMX.

Current status:

- provenance boundary established
- imported helper slice started under `platform/claude-code/upstream/worktree/imported/`
- minimal scope only

## Allowed Import Surface

Only Claude Code-owned worktree runtime units may be imported here:

- worktree lifecycle helpers that create and remove local git worktrees
- SessionStart or hook bootstrap glue that moves a Claude Code session into the created worktree
- lightweight git wrapper code that is inseparable from the Claude Code worktree runtime

## Explicitly Out Of Scope

Do not import these here:

- Shift AX control-plane logic from `core/`
- review or verification gates
- topic artifact schemas
- team runtime
- tmux runtime

## Planned Minimal Upstream Modules

The first Claude Code-side provenance slice should stay as small as possible:

1. `oh-my-claudecode/src/team/git-worktree.ts`
2. `oh-my-claudecode/src/lib/worktree-paths.ts`
3. `oh-my-claudecode/src/team/git-worktree.ts` -> imported `createClaudeManagedWorktree` / `removeClaudeManagedWorktree`

Deferred because it currently mixes worker bootstrap responsibilities with team runtime:

- `oh-my-claudecode/src/team/worker-bootstrap.ts`

Import notes:

- `src/team/git-worktree.ts` is the primary candidate for Claude Code-side create/remove/list lifecycle helpers.
- `src/lib/worktree-paths.ts` already contributes the imported `getWorktreeRoot` helper used to canonicalize platform roots.
- `src/team/git-worktree.ts` now also contributes the imported managed worktree helper used by the Claude Code platform wrapper for create/remove behavior.
- `src/team/worker-bootstrap.ts` stays out until Shift AX is ready to import worker/team overlays.

If an upstream file also pulls in team or tmux runtime behavior, split or rewrite it instead of importing it whole.
