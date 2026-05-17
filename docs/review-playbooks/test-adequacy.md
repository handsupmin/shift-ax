# Test-Adequacy Playbook

## Check
- A passing automated test command is recorded.
- Changed code has aligned test changes or explicit proof no test change was needed.
- Tests reflect the agreed outcome, key constraints, or domain-policy language.
- Changed tests map back to each changed implementation file, not only to the request in general.

## Approve when
- Test evidence is fresh and relevant to the changed behavior.
- The verification path matches the reviewed plan.

## Request changes when
- Code changed without matching test coverage.
- Tests pass but do not cover the reviewed behavior clearly enough.
- A test file was added, but it does not meaningfully exercise or name the changed implementation surface.
