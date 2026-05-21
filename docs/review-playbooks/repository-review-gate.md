# Repository-Review-Gate Playbook

Use the repo-specific gate generated during onboarding before commit finalization.

- Confirm the current repository has a matching `repository_review_gates` entry in the global Shift AX profile.
- Check architecture criteria from the repo gate against the reviewed plan and changed surfaces.
- Check working-process criteria, including verification evidence and any manual process constraints.
- Check convention criteria, including generated-file ownership, native naming, layer naming, and test placement.
- Check side-effect criteria for data, queues/workers, cache, auth/permissions, external APIs, destructive operations, deploy, rollback, and idempotency.
- Request changes when any repo gate category is missing or not reflected in the planning artifacts.
