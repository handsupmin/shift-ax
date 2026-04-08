# Shift AX Core

The `core/` layer owns Shift AX's shared product behavior.

This is where Shift AX should define:

- context resolution
- topic lifecycle
- planning workflow
- review workflow
- policy evaluation
- finalization logic

If a piece of logic should behave the same regardless of whether the host platform is Codex or Claude Code, it should probably live in `core/`.
