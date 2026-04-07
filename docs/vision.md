# Shift AX Vision

## Subtitle

Why Shift AX exists, what it is supposed to do, and how it is planned to be built.

## 1. Why Shift AX Exists

Shift AX starts from a simple observation:

- AI model capability is already high enough for real software work
- good engineering methods already exist
- the bottleneck is often not "can the model code?"
- the bottleneck is whether a team can reliably turn requests into safe, reviewed, policy-aware delivery

That gap gets worse in teams that are new to AX.

Such teams often have this combination:

- they want to use AI more seriously
- they do not want fragile prompt rituals
- they have domain rules and product constraints the model does not know
- they do not want the model to guess through ambiguity
- they want planning, implementation, review, and finalization to feel like one guided system

Shift AX exists to close that gap.

It is meant to make agentic software delivery usable by teams that are **not** already experts in AI-native development workflows.

## 2. Product Thesis

Shift AX is built on these beliefs:

1. The model is not the product. The workflow is the product.
2. The problem is not "how do we make the AI write more code?" The problem is "how do we make software delivery more reliable with AI in the loop?"
3. AI must not invent domain facts when the organization already has documents that define them.
4. Review and verification are not optional cleanup steps. They are first-class gates.
5. The system should work for teams that are new to AX, not just for people who enjoy building prompt stacks by hand.

## 3. What Shift AX Is

Shift AX is an **agentic software delivery platform layer**.

It is intended to sit above coding-agent runtimes and turn them into a guided software-delivery system with:

- document-aware context resolution
- topic/worktree bootstrapping
- planning interviews
- planning review
- disciplined implementation
- structured review
- commit-first finalization in v1, with push/PR automation deferred to a later phase

In other words, Shift AX is meant to help a team move from:

> "Please build this"

to:

> "The request was clarified, grounded in policy/docs, implemented with engineering discipline, reviewed against the agreed spec, and finalized as a meaningful local commit."

Shift AX is intended to be delivered as platform-specific builds, not one monolithic runtime.

The current model is:

- one Codex-oriented build
- one Claude Code-oriented build

Users choose the build that matches the agent platform they already use.

## 4. Who Shift AX Is For

Shift AX is meant for development teams that:

- are not yet deeply familiar with AX-style workflows
- want AI to participate in real SDLC work
- need guardrails, not just power
- want a standard operating model across requests
- already have domain and policy documentation
- want traceability from request to code review

This means Shift AX is **not** designed first as a hacker toy, a prompt playground, or a loose skill bundle.

It is designed first as a guided platform for teams.

## 5. The Main Problem Shift AX Solves

The core problem is not coding.

The core problem is that teams usually lack a reliable control plane for agentic work.

Without that control plane:

- relevant docs are skipped
- ambiguity gets guessed through
- implementation starts too early
- tests cover code shape but not policy/spec intent
- reviews miss the original request context
- delivery is finalized without trustworthy evidence

Shift AX aims to replace that failure mode with a structured path.

## 6. Shift AX's Top Priority

The top priority is:

> **a development team that does not know AX well should still be able to adopt Shift AX quickly and safely**

That has several practical implications.

### 6.1 Strong defaults

The correct path should be the default path.

Users should not need to know:

- which prompt to use
- which review mode to run
- how to manually preserve context
- how to split short tasks from long tasks
- how to remember which docs to consult first

### 6.2 Explicit artifacts

Important facts should live in files, not in hidden conversational memory.

Examples:

- original request
- request summary
- resolved docs and policies
- interview notes
- spec
- review verdicts
- implementation plan
- final commit message and verification evidence

### 6.3 Process over improvisation

Shift AX should guide a team through a predictable flow instead of rewarding whoever knows the most prompt tricks.

## 7. Workflow Shift AX Wants to Enforce

The intended end-to-end flow is:

1. **Context Resolution**
   - read the base-context index
   - find relevant detailed documents
   - load those documents before answering or planning
   - if relevant docs exist, skipping them is not allowed

2. **Topic Bootstrap**
   - create a dedicated worktree for the request
   - create a topic directory for that request
   - store the original request
   - store a request summary and starting assumptions

3. **Planning Interview**
   - talk with the requester until ambiguity is reduced
   - do not guess through missing requirements
   - force clarification of unclear scope, constraints, and non-goals

4. **Planning Review**
   - review the spec before implementation begins
   - check for internal consistency, policy conflicts, and missing requirements

5. **Implementation**
   - use subagents for short, bounded tasks
   - use tmux-backed workers for longer or more durable tasks
   - apply engineering methods such as TDD and architecture constraints

6. **Structured Review**
   - policy review
   - spec-conformance review
   - test adequacy review
   - engineering-discipline review
   - conversation-trace review

7. **Finalization**
   - verify build/test/lint evidence
   - commit only after gates pass
   - stop at a meaningful local git commit in v1

### Base-context convention

The current tracked context convention is:

- one top-level index at `docs/base-context/index.md`
- detailed files under `docs/base-context/`

This directory is intentionally broad enough to cover:

- policy
- domain
- architecture
- team/company context

## 8. Platform Strategy

Shift AX is not intended to reimplement every low-level coding-agent runtime feature from scratch.

Instead, the current strategy is:

- internalize stable runtime code from existing harnesses
- keep platform-specific code separated
- build Shift AX's real value in the common workflow and control plane

Planned structure:

```text
platform/
  codex/
  claude-code/

core/
  context/
  topics/
  planning/
  review/
  policies/
  finalization/

adapters/
  codex/
  claude-code/
```

The user-facing workflow should remain natural-language-first even if internal commands exist.

Top-level commands are still useful, but they should act as:

- internal building blocks
- operator/debugging entrypoints
- automation surfaces

They should not become the main burden for teams that are still new to AX.

### Why this strategy

This approach keeps Shift AX from becoming fragile in two different ways.

It avoids:

- being tightly coupled to external upstream package changes
- reimplementing all low-level runtime machinery unnecessarily

The platform directories are meant to hold internalized platform-specific runtime code, while the common Shift AX logic is owned in the core layer.

## 9. Relationship to Existing Agent Harnesses

Shift AX is heavily informed by existing agent systems such as:

- Claude Code style hook-driven orchestration
- Codex-oriented AGENTS/bootstrap orchestration
- skill-first workflow systems like Superpowers
- stable runtime layering shown by projects like claw-code

But Shift AX is not supposed to be a simple rebrand of those systems.

Its goal is different:

- not just "make agents more powerful"
- but "make AI-assisted delivery safer and easier for ordinary development teams"

That means Shift AX should reuse proven runtime machinery where useful, while owning its own:

- context rules
- planning rules
- review rules
- finalization rules
- team adoption model

## 10. Core Principles

Shift AX should be built around these principles.

### 10.1 No guessing when docs can answer

If the index points to a relevant domain or policy document, the system should read it before moving forward.

### 10.2 No implementation before a reviewable spec

Implementation should not begin from a vague request if the system could instead clarify it.

### 10.3 No hidden state when files can hold the truth

If a future review or worker needs something, it should be written down as an artifact.

Those artifacts should be worktree-local and non-shared by default.

If information must become shared team knowledge, that should happen through deliberate updates to tracked documentation such as `docs/base-context/`, not by exposing temporary planning artifacts in the PR.

### 10.4 No completion claims without evidence

A successful run requires fresh verification, not confidence.

No commit should happen before internal review passes.

### 10.5 No expert-only workflow as the happy path

The system should be understandable and usable even for teams that are early in their AX adoption.

## 11. Non-Goals

Shift AX is not trying to be:

- a general-purpose prompt library
- a toy plugin bundle
- a generic AI chatbot wrapper
- a fully custom model runtime from scratch
- a system that requires every engineer to become an AI workflow engineer

## 12. What Success Looks Like

Shift AX is successful if a team can do the following consistently:

1. submit a natural development request
2. get pulled into the right clarifying discussion
3. have the request grounded in the right domain documents
4. receive a reviewed plan
5. get disciplined implementation without prompt babysitting
6. trust that the final review actually checked the important things
7. receive a local commit with evidence

## 13. Initial Build Direction

The first versions of Shift AX should prioritize:

- documentation and repository structure
- explicit workflow contracts
- context resolution against an index document
- topic/worktree bootstrapping
- planning and review artifacts
- a minimal but reliable finalization path

The initial finalization policy should assume:

- local commit only in v1
- base branch is always `main`
- commit messages must follow the Lore protocol and reference verification evidence

Only after those foundations are clear should the system expand further.

## 14. Final Summary

Shift AX is meant to help a team that is still early in its AX journey use AI for real software delivery without needing to become agent-runtime experts first.

Its purpose is not just to make agents more active.

Its purpose is to make the path from request to a trusted delivery artifact:

- clearer
- safer
- more reviewable
- more repeatable
- easier for ordinary development teams to adopt
