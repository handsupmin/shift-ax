# Claude Code Upstream Imports

This directory records platform-owned runtime code that Shift AX may internalize for Claude Code builds.

Current priority:

- worktree-related runtime only

Deferred until the worktree boundary is stable:

- team runtime
- tmux runtime

Imported code in this subtree must stay platform-specific and must not absorb Shift AX product rules from `core/`.
