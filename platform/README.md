# Platform Layer

The `platform/` layer contains runtime code that is specific to a host agent platform.

Shift AX currently plans to support at least:

- `platform/codex`
- `platform/claude-code`

This layer should hold:

- platform-specific runtime integration
- imported and stabilized execution machinery
- upstream provenance records under `platform/*/upstream/`
- active imported helper slices that are surfaced through platform manifests and bootstrap scaffolds
- host-platform bootstrap glue
- platform-owned scaffold source files for generated build assets

This layer should not own Shift AX's shared workflow rules, review gates, or product-specific policy logic.
