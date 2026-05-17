# Spec-Conformance Playbook

## Check
- `spec.md`, `implementation-plan.md`, and approved `plan-review.json` agree.
- The approved plan fingerprint still matches.
- Changed files stay inside the reviewed scope.
- Side-effect-sensitive scope checks are delegated to the side-effect-risk lane.
- Implementation-plan minimum sections exist: Acceptance Criteria, Verification Commands, Dependencies, Likely Files Touched, Checkpoints, Execution Tasks.

## Approve when
- The reviewed plan is still the active plan.
- Changed files and execution evidence match the approved scope.

## Request changes when
- The plan changed after approval.
- Out-of-scope files changed or required plan sections are missing.
