# Shift AX Operator Guide

**한국어 버전:** [operator-guide.ko.md](./operator-guide.ko.md)

## Purpose

This guide is for teams operating Shift AX day to day.

Use it when you want the shortest safe path from request to reviewed local commit.

## Default operator flow

### 1. Onboard shared context

```bash
shift-ax onboard-context --discover
```

Use file-driven onboarding when the team already has prepared docs:

```bash
shift-ax onboard-context --input ./onboarding.json
```

### 2. Check repo health

```bash
shift-ax doctor
```

### 3. Start a request

```bash
shift-ax run-request --request "<request>"
```

This creates a topic, worktree, planning artifacts, and a human review gate.

### 4. Record human plan review

```bash
shift-ax approve-plan \
  --topic .shift-ax/topics/<topic-slug> \
  --reviewer "<name>" \
  --decision approve
```

### 5. If policy docs must change, update them first

If the reviewed plan requires shared policy or base-context doc updates, Shift AX stops before implementation.

```bash
shift-ax sync-policy-context \
  --topic .shift-ax/topics/<topic-slug> \
  --summary "Updated shared policy docs before implementation" \
  --path docs/base-context/<doc>.md
```

### 6. Resume implementation and review

```bash
shift-ax run-request \
  --topic .shift-ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

### 7. Reopen when downstream feedback says the work is not done

```bash
shift-ax react-feedback \
  --topic .shift-ax/topics/<topic-slug> \
  --kind review-changes-requested \
  --summary "Reviewer requested additional rollback coverage"
```

## Status commands

### Single topic

```bash
shift-ax topic-status --topic .shift-ax/topics/<topic-slug>
```

Shows:
- phase
- review status
- execution status
- policy sync status
- latest failure reason

### Multiple topics

```bash
shift-ax topics-status --limit 10
```

Use this instead of a dashboard when you only need a compact operator view.

For a real team rollout, pair this guide with [pilot-plan.md](./pilot-plan.md).

## When to use launch-execution directly

Use platform launchers when you want the runtime to perform the task itself.

### Codex

```bash
shift-ax launch-execution \
  --platform codex \
  --topic .shift-ax/topics/<topic-slug> \
  --task-id task-1
```

### Claude Code

```bash
shift-ax launch-execution \
  --platform claude-code \
  --topic .shift-ax/topics/<topic-slug> \
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
- run `shift-ax sync-policy-context`

### `review requested more implementation work`
The gates found a real gap.

Action:
- implement the missing work
- keep execution artifacts and tests aligned
- rerun resume or use `shift-ax react-feedback` if the request came later

## Operator rules

- Treat base-context docs as the source of truth.
- Do not skip the human plan review.
- Do not bypass policy sync when shared docs must change.
- Prefer `doctor`, `topic-status`, and `topics-status` before manual debugging.
- Treat execution output artifacts as evidence, not optional notes.
