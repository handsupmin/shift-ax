---
description: Complete or repair Shift AX onboarding for the current repository.
argument-hint: "[--discover | --input <file>]"
---

Use Shift AX onboarding for the current repository.

- If arguments are present after the command, treat them as operator intent for the onboarding mode.
- If no arguments are present, prefer guided onboarding that collects the required business, policy, architecture, path, glossary, and verification information.
- Keep docs-first behavior.

Primary shell commands:

- guided onboarding: `ax onboard-context`
- discovery onboarding: `ax onboard-context --discover`
- file-driven onboarding: `ax onboard-context --input <file>`
- health check after onboarding: `ax doctor`

If the user typed additional arguments, use them to choose the right onboarding path.
