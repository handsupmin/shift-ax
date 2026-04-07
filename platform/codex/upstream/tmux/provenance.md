# Codex Tmux Provenance

## Scope

This document defines the minimal Codex-side tmux runtime slice that Shift AX may internalize from OMC.

Current status:

- provenance boundary established
- imported helper slice started under `platform/codex/upstream/tmux/imported/`
- minimal scope only

## Allowed Import Surface

Only Codex-owned tmux runtime units may be imported here:

- team-name sanitization and tmux-safe naming helpers
- tmux pane/session naming helpers that do not pull full team orchestration
- lightweight tmux argument builders that stay independent from review or policy logic

## Explicitly Out Of Scope

Do not import these here:

- Shift AX control-plane logic from `core/`
- worker orchestration loops
- team state machines
- review or verification gates
- full team runtime bootstrapping

## Planned Minimal Upstream Modules

1. `oh-my-codex/src/team/tmux-session.ts`

Import notes:

- `src/team/tmux-session.ts` already contributes the imported `sanitizeCodexTeamName` helper for future tmux-safe team naming.
- Further tmux/session helpers should only be imported when they can be split away from full team orchestration.
