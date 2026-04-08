# Shift AX Operator Guide

## Purpose

This guide is for teams operating Shift AX day to day.

Use it when you want the shortest safe path from request to reviewed local commit.

## Default operator flow

### 1. Onboard shared context

```bash
npm run ax -- onboard-context --discover
```

Use file-driven onboarding when the team already has prepared docs:

```bash
npm run ax -- onboard-context --input ./onboarding.json
```

### 2. Check repo health

```bash
npm run ax -- doctor
```

### 3. Start a request

```bash
npm run ax -- run-request --request "<request>"
```

This creates a topic, worktree, planning artifacts, and a human review gate.

### 4. Record human plan review

```bash
npm run ax -- approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "<name>" \
  --decision approve
```

### 5. If policy docs must change, update them first

If the reviewed plan requires shared policy or base-context doc updates, Shift AX stops before implementation.

```bash
npm run ax -- sync-policy-context \
  --topic .ax/topics/<topic-slug> \
  --summary "Updated shared policy docs before implementation" \
  --path docs/base-context/<doc>.md
```

### 6. Resume implementation and review

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

### 7. Reopen when downstream feedback says the work is not done

```bash
npm run ax -- react-feedback \
  --topic .ax/topics/<topic-slug> \
  --kind review-changes-requested \
  --summary "Reviewer requested additional rollback coverage"
```

## Status commands

### Single topic

```bash
npm run ax -- topic-status --topic .ax/topics/<topic-slug>
```

Shows:
- phase
- review status
- execution status
- policy sync status
- latest failure reason

### Multiple topics

```bash
npm run ax -- topics-status --limit 10
```

Use this instead of a dashboard when you only need a compact operator view.

## When to use launch-execution directly

Use platform launchers when you want the runtime to perform the task itself.

### Codex

```bash
npm run ax -- launch-execution \
  --platform codex \
  --topic .ax/topics/<topic-slug> \
  --task-id task-1
```

### Claude Code

```bash
npm run ax -- launch-execution \
  --platform claude-code \
  --topic .ax/topics/<topic-slug> \
  --task-id task-1
```

## Common stops and what they mean

### `resolved context still has unresolved base-context paths`
A linked doc is missing or the index is stale.

Action:
- fix the broken doc path
- rerun onboarding or update the index

### `policy context sync is required before implementation can start`
Planning said a shared doc must change before coding.

Action:
- update the shared doc
- run `ax sync-policy-context`

### `review requested more implementation work`
The gates found a real gap.

Action:
- implement the missing work
- keep execution artifacts and tests aligned
- rerun resume or use `ax react-feedback` if the request came later

## Operator rules

- Treat base-context docs as the source of truth.
- Do not skip the human plan review.
- Do not bypass policy sync when shared docs must change.
- Prefer `doctor`, `topic-status`, and `topics-status` before manual debugging.
- Treat execution output artifacts as evidence, not optional notes.
