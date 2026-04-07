# Claude Code Platform

This directory is for Shift AX code that is specific to Claude Code-based execution.

Expected responsibilities:

- hook integration
- Claude Code bootstrap/context injection
- Claude Code-specific runtime and worker glue
- imported and stabilized Claude Code-side harness code
- upstream provenance and import boundaries under `platform/claude-code/upstream/`
- Claude Code build scaffold files under `platform/claude-code/scaffold/`

The long-term goal is for this layer to expose Claude Code as a stable execution platform while Shift AX's shared workflow logic stays outside this directory.
