# Side-Effect-Risk Playbook

## Check
- Every changed file is listed in `Likely Files Touched` or an execution-lane `allowed_paths` contract.
- Database, migration, dependency, build config, deployment, security, payment, scheduled, and worker surfaces include explicit risk, compatibility, rollback, deployment, or verification language in the reviewed artifacts.
- Side-effect-sensitive files have a passing verification command that matches the affected surface.

## Approve when
- Changed files stay inside the reviewed path set.
- Risky surfaces are acknowledged in the spec or plan.
- Verification evidence is specific enough for the changed surface.

## Request changes when
- A changed file was not in the reviewed path set.
- A risky surface changed without mitigation language.
- Verification passed in general, but not for the side-effect-sensitive surface.
