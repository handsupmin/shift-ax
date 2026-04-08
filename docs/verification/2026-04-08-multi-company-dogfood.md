# 2026-04-08 Multi-company Dogfood

## Scope

Dogfooding Shift AX against realistic sample repos representing:

1. **HanPay** — fintech — Codex platform case
2. **MediFlow** — healthcare — Claude Code platform case
3. **ShopBridge** — commerce — core/operator flow case

## What was verified

### HanPay / Codex

- `ax onboard-context --discover`
- `ax doctor`
- `ax run-request`
- `ax approve-plan`
- planning-detected policy sync gate
- `ax sync-policy-context`
- real `ax launch-execution --platform codex`

Observed:

- docs-first onboarding worked
- policy sync blocked implementation until the shared doc was updated
- the real Codex runtime edited the worktree and eventually produced execution output artifacts
- execution output artifacts were plain text, but still sufficient for file-based traceability

Follow-up hardening:

- execution orchestrator now reuses existing non-empty output artifacts instead of re-running the same task
- codex launcher now passes prompt content as an explicit prompt argument instead of relying on stdin piping

### MediFlow / Claude Code

- `ax onboard-context --discover`
- `ax run-request`
- `ax approve-plan`
- real `ax launch-execution --platform claude-code`

Observed before hardening:

- launcher produced an empty output file
- no worktree edits appeared
- the process could sit for a long time without producing a clear terminal error

Follow-up hardening:

- claude launcher now passes prompt content as an explicit prompt argument
- claude launcher now uses `--no-session-persistence`
- claude launcher now fails with an explicit timeout error instead of hanging indefinitely

Current post-fix status:

- **fail-fast behavior verified**
- **fully successful real Claude Code end-to-end edit path still not verified in this environment**

### ShopBridge / Core operator flow

- `ax onboard-context --discover`
- `ax doctor`
- `ax run-request`
- `ax approve-plan`
- `ax run-request --resume`
- `ax react-feedback`
- `ax topic-status`
- `ax topics-status`

Observed:

- request-to-topic bootstrap worked
- doctor and compact status surfaces worked
- feedback reaction reopened implementation as intended
- multi-topic status view worked

Observed gap before hardening:

- if the original request text was generic, but the planning interview clarified which policy applied, `resolved-context.json` could miss that policy because context resolution only used the raw request

Follow-up hardening:

- `run-request` now resolves base-context using the finalized planning artifacts, not just the initial request text

## Result

### Confirmed strong

- discovery onboarding
- docs-first guardrails
- policy sync before implementation
- compact topic and multi-topic supervision
- doctor surface
- downstream feedback reopening

### Confirmed improved by this follow-up slice

- context resolution now respects planning interview details
- execution reuse avoids rerunning already materialized tasks
- real launcher paths now use explicit prompt arguments
- Claude Code launcher now fails fast on runtime timeout instead of silently hanging

### Still not fully proven

- a completely successful real Claude Code edit session in this local environment

## Verification commands

- targeted regression tests for the dogfood findings
- `npm test`
- `npm run build`
