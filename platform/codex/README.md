# Codex Platform

This directory is for Shift AX code that is specific to Codex-based execution.

Expected responsibilities:

- Codex session/bootstrap integration
- Codex-specific runtime and worker glue
- imported and stabilized Codex-side harness code
- upstream provenance and import boundaries under `platform/codex/upstream/`
- Codex build scaffold files under `platform/codex/scaffold/`

The long-term goal is for this layer to expose Codex as a stable execution platform while Shift AX's shared workflow logic stays outside this directory.
