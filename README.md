# Shift AX

<div align="center">

<img src="./logo.png" alt="Shift AX logo" width="260" />

### An easy AX helper for work that lives above the project.

Reduce repetitive context work across repositories, teach the tool your language once, and turn request-to-commit delivery into a guided loop.

[![npm version](https://img.shields.io/npm/v/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![npm downloads](https://img.shields.io/npm/dm/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![GitHub stars](https://img.shields.io/github/stars/handsupmin/shift-ax)](https://github.com/handsupmin/shift-ax/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/handsupmin/shift-ax/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](https://github.com/handsupmin/shift-ax/blob/main/README.md) | [한국어](https://github.com/handsupmin/shift-ax/blob/main/README.ko.md) | [简体中文](https://github.com/handsupmin/shift-ax/blob/main/README.zh.md) | [日本語](https://github.com/handsupmin/shift-ax/blob/main/README.ja.md) | [Español](https://github.com/handsupmin/shift-ax/blob/main/README.es.md)

</div>

Built for people who want AI to help with real delivery work, but do not want to become experts in prompt rituals first.

`shift-ax` is an easy AX helper that sits **above any single project**. It keeps reusable context at the global level, learns your domain language over time, and gives coding-agent runtimes a guided request-to-commit loop.

---

## Why Shift AX?

Most friction in AI-assisted development is not “can the model write code?”

The real pain usually looks like this:

- you keep re-injecting the same context across multiple projects
- your domain terms and team language are not grounded anywhere durable
- routine work still needs too much manual babysitting
- you know the design matters, but the rest of delivery still feels fragile
- you are not fully sure how to “use AI well,” so the whole thing feels harder than it should

Shift AX exists to make that layer easier.

If you can get the design and requirements into good shape, Shift AX is built to help the rest of the flow move forward with much less repeated prompting and much stronger process guidance.

---

## What you get

- **Global reusable context**
  Keep important context above the project level so you do not have to keep injecting it repo by repo.

- **Domain language that gets learned over time**
  Teach Shift AX your terms, policies, procedures, and recurring concepts once, then keep reusing them.

- **A workflow tuned for routine delivery work**
  Great for repeated engineering work where requests, plans, reviews, and verification need to happen the same way every time.

- **Detailed onboarding with strong defaults**
  Even if you are not already good at using AI coding tools, Shift AX is designed to get you into a usable path quickly.

- **Request-to-commit guardrails**
  Resolve context first, review the plan, then move through implementation, verification, review, and final commit with less ambiguity.

---

## Install & quick start

```bash
npm install -g shift-ax
shift-ax --codex
```

Or start Claude Code instead:

```bash
shift-ax --claude-code
```

That is enough to begin.
On first run, Shift AX asks for your preferred language and whether full-auto should be enabled by default, then walks you into the right runtime flow.

After that, run onboarding once, teach it your reusable context, and start requests from there.

- **CLI command:** `shift-ax`
- **Requirements:** Node.js 20+

If you want to work from source instead of a global install:

```bash
npm install
npm run build
npm link
```

---

## Common moves

### Onboard reusable context once

Shift AX keeps reusable knowledge in:

- `~/.shift-ax/index.md` as the single dictionary of searchable labels, aliases, repositories, workflows, and domain terms
- `~/.shift-ax/role/`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/repos/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

Inside the runtime:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

This is where Shift AX starts learning how your work actually sounds and flows. Onboarding verifies that the dictionary links to real docs and that the saved context is usable before treating onboarding as complete.

### Start a request

Inside the runtime:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX resolves context first, creates a request-scoped topic/worktree, pauses for plan review, and then resumes through implementation, verification, review, and commit.

### Resume, review, and inspect later

Common runtime commands:

- **Codex:** `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### Run the flow from CLI when needed

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

---

## Why it feels natural

**Shift AX works above the project, but still fits into the tools you already use.**

That matters because a lot of repeated AX pain is not tied to one repository.
It lives in things like:

- how your team names concepts
- how your domain talks about policies and business rules
- what “done” usually means
- which review and verification steps always matter
- which routine tasks come back again and again

Shift AX keeps that context globally instead of forcing you to reteach it inside every repo.

So instead of rebuilding the same context stack from scratch every time, you gradually accumulate a reusable operating layer:

- global context
- learned domain language
- reusable procedures
- repeatable request handling

That is what makes it feel less like prompt juggling and more like an actual working system.

---

## A realistic workflow

Imagine you work across:

- multiple product repos
- an internal platform repo
- one or two customer-specific repos
- a steady stream of recurring delivery tasks

Without Shift AX, every new AI session tends to repeat the same overhead:

- explain the domain again
- restate the company language again
- restate the review rules again
- restate the expected delivery flow again

With Shift AX, you onboard that reusable layer once, keep it globally, and let each new request start from a stronger default place.

That is the core promise:

> less repetitive context injection,
> more guided delivery that compounds over time.

---

## Core concepts

- **Global context**
  Reusable work knowledge that lives above any single repository.

- **Domain language**
  The vocabulary, concepts, and policy terms your organization uses repeatedly.

- **Topic/worktree**
  A request-scoped working lane with its own artifacts and state.

- **Plan review gate**
  Shift AX pauses before implementation so a human can confirm the plan.

- **Request-to-commit loop**
  Context resolution, planning, implementation, verification, review, and commit as one guided flow.

---

## Give this prompt to another LLM

If you want another LLM to install and use Shift AX for you, give it this:

```text
You are setting up and using Shift AX in this repository.

Goal:
- install Shift AX
- start the correct runtime shell
- onboard reusable context
- start the first request safely

Rules:
- use `shift-ax`, not `ax`, in user-facing commands
- if Shift AX is not installed, run `npm install -g shift-ax`
- if working from a source checkout instead of a global install, run:
  - `npm install`
  - `npm run build`
  - `npm link`
- prefer `shift-ax --codex` unless the user explicitly wants Claude Code
- on first run, answer the language question using the user's language preference
- on first run, answer the full-auto question cautiously
- if `~/.shift-ax/index.md` does not exist, onboard first
- in Codex use `$onboard` and `$request ...`
- in Claude Code use `/onboard` and `/request ...`
- do not start implementation before plan approval
- if shared policy/context docs must change first, update them before resume

Suggested first commands:
1. `shift-ax --codex`
2. run `$onboard`
3. run `$request <the user's task>`
```

---

## Quality Metrics

The following numbers are produced by the eval suite in `tests/eval/` and serve as the regression floor for every PR.

| Metric | Value | Suite |
|---|---|---|
| Context Resolver Recall@5 | **100%** (10/10) | `eval` |
| Context Resolver MRR | **1.000** | `eval` |
| Context Resolver False Positive Rate | **0%** | `eval` |
| Glossary Extraction Precision | **100%** (9/9) | `eval` |
| Topic Recall Accuracy | **100%** (4/4) | `eval` |
| Consistency (same input → same output) | **100%** (3/3) | `eval` |
| Realistic Recall@5 (vocabulary-matched queries) | **70%** (7/10) | `eval:real-world` |
| Realistic Topic History Recall | **100%** (6/6) | `eval:real-world` |
| Realistic Glossary Precision (real codebases) | **100%** (7/7) | `eval:real-world` |
| Edge Case Pass Rate | **100%** (33/33) | `eval:edge-cases` |
| Context Resolver p50 Latency | **< 1ms** | `eval:performance` |
| Context Resolver p95 Latency | **< 1ms** | `eval:performance` |
| Sequential Throughput | **> 3000 q/s** | `eval:performance` |

> **How to reproduce:** run `npm run eval:all` from the repository root. Every number in this table is recomputed from scratch each time — no hardcoded results.

The 70% realistic recall reflects a known property of the lexical token-matching algorithm: queries that use different vocabulary than the index label (e.g. "bundle size jumped" vs "Frontend performance budget") will miss without semantic embedding. Queries that share key terms with the label score at 100%.

### Running the eval suite

```bash
npm run eval               # golden path + core correctness
npm run eval:edge-cases    # empty, malformed, adversarial inputs
npm run eval:real-world    # realistic engineering-team fixtures
npm run eval:performance   # latency (p50/p95) + throughput
npm run eval:all           # full suite (CI gate)
```

Each script prints a per-scenario PASS/FAIL with the measured value, then a final scorecard. Any metric below its baseline floor causes exit code 1, which blocks CI.

---

## Documentation

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Operator guide: [`docs/operations/operator-guide.md`](./docs/operations/operator-guide.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
