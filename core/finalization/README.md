# Core Finalization

`core/finalization` is for post-review delivery logic.

This layer currently owns the v1 local-finalization path:

- final verification gates
- commit readiness checks
- Lore-compatible commit message generation / validation
- local git commit creation and commit-state recording

Deferred to a later phase:

- push gating
- PR body generation
- PR opening logic
