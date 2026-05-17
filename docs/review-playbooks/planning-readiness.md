# Planning-Readiness Playbook

## Check
- `readiness-assessment.json` exists or can be rebuilt from request, brainstorm, spec, and implementation plan.
- Ambiguity score is at or below the configured threshold, currently `0.2`.
- Goal, constraints, success criteria, context, and implementation scope all have concrete evidence.

## Approve when
- The assessment status is `ready`.
- There are no readiness blockers.
- The remaining ambiguity is small enough for code-level decisions.

## Request changes when
- The request still lacks explicit outcome, constraints, verification, context, or likely files.
- The plan relies on vague implementation tasks that a developer could interpret in several incompatible ways.
