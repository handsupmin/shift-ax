# Shift AX Vision

## Subtitle

Why Shift AX exists, what it should make easier, and how it is meant to turn agentic development into a usable delivery system for ordinary teams.

## 1. Why Shift AX Exists

Shift AX starts from a simple observation:

- AI model capability is already strong enough for real software work
- the hard part is usually not code generation itself
- the hard part is repeated context setup, ambiguity handling, and delivery discipline
- that gap becomes even worse when work spans many projects and teams

In practice, many teams run into the same pattern:

- they keep re-explaining the same domain context across repositories
- important terms and business language are not grounded anywhere durable
- routine work still depends on manual prompt babysitting
- they know good design matters, but the rest of the flow is still brittle
- they want to use AI seriously, but they do not know how to build the right workflow around it

Shift AX exists to close that gap.

It is meant to make agentic software delivery usable by teams that are **not already experts in AI-native workflows**.

## 2. Product Thesis

Shift AX is built on these beliefs:

1. The model is not the product. The workflow is the product.
2. The problem is not “how do we get the AI to write more code?” The problem is “how do we reduce repeated work and make delivery more reliable with AI in the loop?”
3. Global reusable context matters because a lot of important work knowledge lives above any one project.
4. Domain language, policy language, and recurring procedures should compound over time instead of being re-taught in every session.
5. Review and verification are not optional cleanup. They are first-class gates.
6. The system should work for teams that are new to AX, not just for people who enjoy building prompt stacks by hand.

## 3. What Shift AX Is

Shift AX is an **easy AX helper and agentic delivery layer**.

It sits above coding-agent runtimes and turns them into a guided delivery system with:

- global context onboarding
- document-aware context resolution
- domain-language accumulation
- topic/worktree bootstrapping
- planning interviews
- planning review
- disciplined implementation
- structured review
- commit-first finalization in v1, with push/PR automation deferred to a later phase

In practical terms, Shift AX is built for a workflow where, once the design is in good shape, the rest of delivery should become much easier to carry through reliably.

## 4. Who Shift AX Is For

Shift AX is meant for development teams and individual operators who:

- are not yet deeply familiar with AX-style workflows
- want AI to participate in real SDLC work
- want guardrails, not just raw power
- want to reduce repeated context injection across projects
- have domain and policy knowledge that should be learned once and reused
- want routine delivery work to become more repeatable over time
- want traceability from request to code review

This means Shift AX is **not** designed first as a hacker toy, a prompt playground, or a loose skill bundle.

It is designed first as an operational helper that makes AX adoption easier.

## 5. The Main Problem Shift AX Solves

The core problem is not coding.

The core problem is that teams usually lack a reliable control plane for agentic work that:

- remembers the right reusable context globally
- keeps domain language and procedures grounded in files
- reduces repeated setup work across requests
- slows down at the right review gates
- helps routine work feel structured instead of improvised

Without that control plane:

- relevant docs are skipped
- ambiguity gets guessed through
- implementation starts too early
- teams keep re-injecting the same background over and over
- reviews miss domain and policy context
- delivery is finalized without trustworthy evidence

Shift AX aims to replace that failure mode with a guided path.

## 6. Shift AX's Top Priority

The top priority is:

> **a team that does not know AX well should still be able to adopt Shift AX quickly, safely, and without becoming AI workflow experts first**

That has several practical implications.

### 6.1 Strong defaults

The correct path should be the default path.

Users should not need to know:

- which prompt to use
- which review mode to run
- how to manually preserve context
- how to split short tasks from long tasks
- how to remember which docs to consult first
- how to teach the system the same domain language again and again

### 6.2 Explicit artifacts

Important facts should live in files, not in hidden conversational memory.

Examples:

- original request
- request summary
- resolved docs and policies
- learned domain language
- interview notes
- spec
- review verdicts
- implementation plan
- final commit message and verification evidence

### 6.3 Process over improvisation

Shift AX should guide a team through a predictable flow instead of rewarding whoever knows the most prompt tricks.

### 6.4 Onboarding that teaches good usage by default

The onboarding flow should be detailed enough that even people who are not already good at “using AI well” can still end up on a safe, productive path.

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

Shift AX is not trying to reimplement every low-level coding-agent runtime feature from scratch.

Instead, the current strategy is:

- internalize stable runtime code from existing harnesses
- keep platform-specific code separated
- build Shift AX's real value in the shared workflow and control plane above the project level

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
```
