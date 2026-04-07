# Shift AX

> Agentic software delivery for teams that want guardrails, not prompt rituals.

**Default language:** English  
**한국어 문서:** [README.ko.md](./README.ko.md)

Shift AX turns a raw development request into a document-aware, review-gated workflow that ends at a meaningful local git commit.

## What Shift AX does

Shift AX adds a control plane on top of existing coding-agent runtimes so teams can:

- onboard domain and policy context into tracked docs
- resolve relevant context before planning or implementation
- create a request-scoped topic directory and git worktree
- pause at a mandatory human plan-review gate
- resume with automated verification and structured review lanes
- finalize only after the gates allow a local Lore-protocol commit

## Current v1 boundary

**Implemented in v1:** request-to-commit.

That means Shift AX currently covers:

1. first-run context onboarding
2. request bootstrap + worktree creation
3. context resolution
4. brainstorming / spec / implementation-plan artifacts
5. human plan approval
6. review-lane aggregation
7. local commit finalization

**Out of v1:** GitHub push / PR automation in the core flow.

## Repository layout

- [`core/`](./core/README.md): shared Shift AX workflow logic
- [`platform/`](./platform/README.md): platform-specific runtime code
- [`adapters/`](./adapters/README.md): bridges from core to platform surfaces
- [`scripts/`](./scripts/README.md): operator-facing CLI entrypoints
- [`docs/vision.md`](./docs/vision.md): product direction
- [`docs/architecture/initial-repo-structure.md`](./docs/architecture/initial-repo-structure.md): structure and ownership boundaries

## Quick start

### 1. Install and verify

```bash
npm install
npm test
npm run build
```

### 2. Onboard base context

Interactive mode:

```bash
npm run ax -- onboard-context
```

File-driven mode:

```bash
npm run ax -- onboard-context --input ./onboarding.json
```

This writes tracked docs under `docs/base-context/`, regenerates `docs/base-context/index.md`, and stores shared engineering defaults in `.ax/project-profile.json`.

### 3. Start a request

```bash
npm run ax -- run-request --request "Build safer auth refresh flow"
```

This creates:

- `.ax/topics/<topic-slug>/`
- `.ax/worktrees/<topic-slug>/`
- request, summary, brainstorm, spec, plan-review, `execution-handoff.json`, workflow-state, review, and finalization artifacts

By default, Shift AX now interviews for planning details before it writes the planning artifacts. The pipeline then pauses at the human plan-review gate.

### 4. Record plan approval

```bash
npm run ax -- approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "Alex" \
  --decision approve
```

### 5. Resume after approval

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

When the review gates pass, Shift AX now auto-generates a Lore-compatible commit message and creates the local commit automatically by default.

Artifacts include:

- `.ax/topics/<topic-slug>/final/commit-message.md`
- `.ax/topics/<topic-slug>/execution-handoff.json`

Use `--no-auto-commit` only if a human explicitly wants to hold the final commit step:

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --no-auto-commit
```

## Mandatory human-escalation triggers

Even after plan approval, Shift AX must stop and request human review if any of these appear:

1. a new user flow is required that was not in the reviewed plan
2. a domain or policy document conflicts with the implementation approach
3. a risky data or permission change appears unsafe to de-risk with tests alone

Persist that stop in workflow state with:

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --escalation policy-conflict:"Auth policy conflicts with the proposed flow"
```

Resume only after human review clears the stop:

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --clear-escalations \
  --escalation-resolution "Reviewer approved the updated approach"
```

Supported escalation kinds:

- `new-user-flow`
- `policy-conflict`
- `risky-data-or-permission-change`

## Review model

Shift AX currently ships five required review lanes:

- domain-policy
- spec-conformance
- test-adequacy
- engineering-discipline
- conversation-trace

The aggregate review gate is written to:

- `.ax/topics/<topic-slug>/review/aggregate.json`
- `.ax/topics/<topic-slug>/review/summary.md`

## Designed for non-expert teams

Shift AX is intentionally opinionated:

- documents first, not guessing
- artifacts first, not hidden context
- approval gates first, not trust-me automation
- strong defaults first, not workflow spelunking

The goal is simple: a team that is new to AX should still be able to use the system safely.
