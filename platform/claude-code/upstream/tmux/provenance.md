# Claude Code Tmux Provenance

## Scope

This document defines the minimal Claude Code-side tmux runtime slice that Shift AX may internalize from OMC.

Current status:

- provenance boundary established
- imported helper slice started under `platform/claude-code/upstream/tmux/imported/`
- minimal scope only

## Allowed Import Surface

Only Claude Code-owned tmux runtime units may be imported here:

- tmux-safe name sanitization helpers
- detached session naming helpers
- tmux session builders that can be split away from full team orchestration

## Explicitly Out Of Scope

Do not import these here:

- Shift AX control-plane logic from `core/`
- worker orchestration loops
- team state machines
- review or verification gates
- full team runtime bootstrapping

## Planned Minimal Upstream Modules

1. `oh-my-claudecode/src/team/tmux-session.ts`

Import notes:

- `src/team/tmux-session.ts` already contributes the imported `sanitizeClaudeSessionNamePart` and `buildClaudeWorkerSessionName` helpers.
- Further tmux/session helpers should only be imported when they can be split away from full team orchestration.
