# Shift AX Initial Repository Structure

## Purpose

This document defines the initial repository layout for Shift AX.

The structure is meant to support two goals at the same time:

1. keep platform-specific runtime code isolated
2. keep Shift AX's own workflow, policy, and review logic owned in one shared control plane

This is important because Shift AX is not meant to be a thin rebrand of an existing harness. It is meant to be its own product layer on top of stable agent runtimes.

## Design Rules

- `platform/` contains runtime code that is specific to a host agent platform
- `core/` contains Shift AX's shared logic and product behavior
- `adapters/` connect `core/` logic to each platform implementation
- `scripts/` contain top-level operator and automation entrypoints
- `docs/` explain architecture, workflow contracts, and adoption

The repository should avoid mixing product rules into platform runtime code unless the logic is truly inseparable from the platform surface.

## Initial Structure

```text
shift-ax/
  docs/
    architecture/
      initial-repo-structure.md
    vision.md

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

  scripts/
```

## Directory Responsibilities

### `platform/codex`

Owns Codex-specific runtime code and imported execution machinery.

Examples:

- Codex bootstrap integration
- Codex-native prompts or skill glue
- Codex-specific team/runtime helpers
- upstream provenance records and imported runtime slices under `platform/codex/upstream/`
- imported and stabilized runtime code that only makes sense in Codex sessions

This layer should not become the home for Shift AX's product rules.

### `platform/claude-code`

Owns Claude Code-specific runtime code and imported execution machinery.

Examples:

- hook integration
- Claude Code bootstrap/context injection
- Claude Code-specific team/runtime helpers
- upstream provenance records and imported runtime slices under `platform/claude-code/upstream/`
- imported and stabilized runtime code that only makes sense in Claude Code sessions

This layer should also avoid owning Shift AX's cross-platform workflow logic.

### `core/context`

Owns document and policy resolution logic.

This is where Shift AX should implement:

- index document lookup
- relevant policy path resolution
- loading of required supporting documents
- no-guessing context gates

### `core/topics`

Owns the request-scoped workspace model.

This is where Shift AX should define:

- topic slug generation
- topic directory layout
- request logging
- request summary storage
- worktree bootstrap metadata

### `core/planning`

Owns the planning control plane.

This is where Shift AX should implement:

- planning interview flow
- ambiguity tracking
- spec generation
- planning review state
- implementation handoff contracts

### `core/review`

Owns the review and verification gates.

This is where Shift AX should implement:

- domain/policy review
- spec-conformance review
- test adequacy review
- engineering-discipline review
- conversation-trace review
- verdict aggregation

### `core/policies`

Owns structured policy definitions and reusable rule sets.

Examples:

- engineering method requirements
- policy schemas
- review rubric definitions
- org-level defaults

### `core/finalization`

Owns post-review delivery logic.

Examples:

- final verification gate
- commit readiness checks
- Lore commit message generation
- local git commit finalization
- later-phase push / PR logic outside the v1 core

### `adapters/codex`

Bridges shared Shift AX logic to the Codex runtime surface.

Examples:

- map `core/context` requirements to Codex entrypoints
- bridge topic bootstrap into Codex sessions
- call Codex-native workers from core orchestration

### `adapters/claude-code`

Bridges shared Shift AX logic to the Claude Code runtime surface.

Examples:

- map `core/context` requirements to hook-driven entrypoints
- bridge topic bootstrap into Claude Code sessions
- connect review and finalization flows to Claude Code runtime mechanics

### `scripts`

Owns operator-facing top-level commands.

Examples:

- `ax`
- `ax-bootstrap-topic`
- `ax-resolve-context`
- `ax-review`
- `ax-finalize-commit`

These commands should feel simple enough for teams that are not AX experts.

## What Should Not Happen

- `platform/*` should not become a dumping ground for product logic
- `core/*` should not directly assume Codex-only or Claude-only APIs
- review rules should not be buried inside implementation prompts
- context resolution should not stay implicit in conversational memory
- finalization should not happen without passing review and verification artifacts

## Recommended First Build Order

The first build steps should focus on creating a usable control plane before expanding runtime complexity.

### Phase 1: Control-plane foundation

- implement the topic directory contract
- implement the context-resolution contract
- define the review verdict schema
- define the commit/finalization artifact schema

### Phase 2: Platform entrypoints

- wire one platform entrypoint for Codex
- wire one platform entrypoint for Claude Code
- prove that both can bootstrap the same topic/context flow

Current status:

- a shared adapter contract exists
- Codex and Claude Code manifests can be inspected through the platform adapter layer
- worktree support is now part of the shared platform manifest contract
- actual host-runtime wiring is still pending

### Phase 3: Planning pipeline

- implement planning interview artifacts
- implement spec review artifacts
- implement implementation handoff artifacts

### Phase 4: Review and shipping

- implement the five required review lanes
- implement final verification gate
- implement local commit finalization, then layer push / PR flows later if needed

## Adoption Constraint

The layout should continue to support the project's top priority:

> teams that do not know AX well should still be able to adopt Shift AX safely and quickly

That means:

- top-level commands should stay simple
- repository boundaries should stay legible
- the default workflow should be visible in docs, not hidden in tribal knowledge
- important state should be artifact-driven, not context-window-driven
