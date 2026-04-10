# Shift AX

> Agentic software delivery for teams that want guardrails, not prompt rituals.

**Default language:** English
**한국어 문서:** [README.ko.md](./README.ko.md)

Shift AX turns a raw development request into a document-aware, review-gated workflow that ends at a meaningful local git commit.

Its primary reusable knowledge base now lives in:

- `~/.shift-ax/`
- main index: `~/.shift-ax/index.md`

It also supports a platform-specific conversational shell:

- `shift-ax --codex`
- `shift-ax --claude-code`

Before handing off to Codex or Claude Code, Shift AX asks for the user's preferred language once and stores it in `~/.shift-ax/settings.json`. After that, it launches the platform shell directly without spending the first assistant turn on a startup lecture.

## What Shift AX does

Shift AX adds a control plane on top of existing coding-agent runtimes so teams can:

- onboard reusable work knowledge into a global `~/.shift-ax/` index
- structure that knowledge into work types, related repositories, per-repository working methods, and domain language
- keep the main index lightweight and link-based so retrieval stays token-efficient
- resolve relevant context before planning or implementation
- recall similar completed topics as supporting context after authoritative docs have been checked
- keep a lightweight file-backed register of important decisions and when they became valid
- search decision memory with linked source-topic summaries when the team needs to recall why something became policy
- run a compact doctor check for repo, topic, and launcher health when setup looks suspicious
- create a request-scoped topic directory and git worktree
- pause at a mandatory human plan-review gate
- block implementation until any required shared policy/base-context doc updates have been written and recorded
- resume with automated verification and structured review lanes
- reopen implementation with a file-backed reaction trail when downstream review or CI fails
- expose a compact topic-status view for the current phase, review gate, execution state, and last failure reason
- expose a compact multi-topic status list when a team needs lightweight supervision without a dashboard
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
- [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md): architecture goals, differentiators, and adopted concepts by layer
- [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md): machine-oriented install and bootstrap guide for LLM agents
- [`docs/architecture/initial-repo-structure.md`](./docs/architecture/initial-repo-structure.md): structure and ownership boundaries

## Quick start

### 1. Install

Global install from npm:

```bash
npm install -g @handsupmin/shift-ax
```

One-command install:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

### 2. Verify

After install:

```bash
shift-ax --codex
# or
shift-ax --claude-code
```

From a source checkout:

```bash
npm install
npm test
npm run build
npm link
shift-ax doctor
```

### 3. Run onboarding

Conversational shell mode:

```bash
shift-ax --codex
# or
shift-ax --claude-code
```

Before the runtime opens, Shift AX asks for the preferred language once if it is not already stored:

- `1. English (default)`
- `2. Korean`

That preference is saved in `~/.shift-ax/settings.json` and reused on the next run.

If `~/.shift-ax/index.md` does not exist yet, open the shell and run:

```text
# Codex
$onboard

# Claude Code
/onboard
```

Shift AX should begin with:

> This step matters most. Please invest 10 minutes so Shift AX can understand how you work.

The onboarding flow should capture:

1. work types
2. related repositories
3. per-repository working methods
4. domain language

The resulting knowledge is written under `~/.shift-ax/`, and `~/.shift-ax/index.md` stays lightweight by linking to detailed pages.

The shell should open cleanly. Shift AX should not inject a long startup monologue into the first assistant turn just to explain its command surface.

Inside the shell, the agent should accept product-shell commands such as:

- Codex: `$onboard`
- Claude Code: `/onboard`
- `/doctor` or `$doctor`
- `/request <text>` or `$request <text>`
- `/export-context`
- `/status`
- `/topics`
- `/resume <topic>`
- `/review <topic>`

Platform-native command files are now scaffolded for both runtimes:

- Codex: `.codex/prompts/{onboard,request,export-context,doctor,status,topics,resume,review}.md`
- Claude Code: `.claude/commands/{onboard,request,export-context,doctor,status,topics,resume,review}.md`

Interactive mode:

```bash
shift-ax onboard-context
```

File-driven mode:

```bash
shift-ax onboard-context --input ./onboarding.json
```

Discovery-assisted mode:

```bash
shift-ax onboard-context --discover
```

This writes or migrates knowledge into `~/.shift-ax/`, regenerates `~/.shift-ax/index.md`, creates linked detailed pages there, and stores shared engineering defaults in `~/.shift-ax/profile.json`.

### 4. Start a request

```bash
shift-ax run-request --request "Build safer auth refresh flow"
```

This creates:

- `.ax/topics/<topic-slug>/`
- `.ax/worktrees/<topic-slug>/`
- request, summary, brainstorm, spec, plan-review, `execution-handoff.json`, workflow-state, review, and finalization artifacts

By default, Shift AX now interviews for planning details before it writes the planning artifacts. The pipeline then pauses at the human plan-review gate.

If the global index is missing, `/request` should stop by default and recommend `onboard` first. It may continue only after an explicit lower-accuracy confirmation.

### 5. Record plan approval

```bash
shift-ax approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "Alex" \
  --decision approve
```

### 6. Resume after approval

If the approved plan says shared domain or policy docs must be updated first, record that before implementation resumes:

```bash
shift-ax sync-policy-context \
  --topic .ax/topics/<topic-slug> \
  --summary "Updated shared auth policy docs before implementation" \
  --path docs/base-context/auth-policy.md
```

Then resume:

```bash
shift-ax run-request \
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
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --no-auto-commit
```

### 7. Materialize platform launch commands when needed

```bash
shift-ax launch-execution \
  --platform codex \
  --topic .ax/topics/<topic-slug> \
  --dry-run
```

This reads `execution-handoff.json`, writes per-task execution prompts, and returns the concrete Codex / Claude / tmux launch commands for the planned slices.

### 8. Inspect compact topic status when needed

```bash
shift-ax topic-status --topic .ax/topics/<topic-slug>
```

## Mandatory human-escalation triggers

Even after plan approval, Shift AX must stop and request human review if any of these appear:

1. a new user flow is required that was not in the reviewed plan
2. a domain or policy document conflicts with the implementation approach
3. a risky data or permission change appears unsafe to de-risk with tests alone

Persist that stop in workflow state with:

```bash
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --escalation policy-conflict:"Auth policy conflicts with the proposed flow"
```

Resume only after human review clears the stop:

```bash
shift-ax run-request \
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
