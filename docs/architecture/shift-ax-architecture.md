# Shift AX Architecture

**Default language:** English  
**한국어 버전:** [shift-ax-architecture.ko.md](./shift-ax-architecture.ko.md)

This document explains Shift AX from an architecture point of view:

1. what it is for
2. what makes it different
3. which ideas it borrows from other systems, and how those ideas are translated into Shift AX's own layers and rules

For the detailed adoption backlog, see [../roadmap/source-adoption-backlog.md](../roadmap/source-adoption-backlog.md).

## 1. What Shift AX is for

Shift AX exists to make **agentic software delivery usable for teams that are not already fluent in AX-style workflows**.

Its purpose is not to make a model produce more raw code. Its purpose is to make a team's delivery flow more reliable by adding:

- document grounding
- request-scoped artifacts
- planning interviews
- human plan review
- policy sync gates
- structured review
- meaningful finalization

In short, Shift AX is a **control plane above coding-agent runtimes**.

It is designed to turn:

> “Please build this.”

into:

> “The request was grounded in shared docs, clarified with the requester, reviewed before implementation, built with guardrails, reviewed again with evidence, and finalized in an auditable way.”

## 2. What makes Shift AX different

Shift AX is intentionally different from “prompt kit” style agent setups.

### 2.1 Docs-first, not memory-first

The primary source of truth is:

1. `docs/base-context/index.md`
2. linked markdown documents
3. reviewed topic artifacts

Long-term memory, topic recall, decision memory, and support summaries exist only **below** that layer.

### 2.2 Workflow-first, not model-first

The product thesis is:

- the model is already good enough
- the bottleneck is workflow reliability
- the workflow must carry the engineering discipline

That means Shift AX treats planning, review, policy sync, and commit gates as product features, not optional habits.

### 2.3 File-backed, not hidden-context-driven

Shift AX prefers artifacts over invisible conversational state:

- request
- summary
- resolved context
- brainstorm
- spec
- implementation plan
- execution state
- review results
- verification evidence
- commit state

This is how it stays teachable, reviewable, and resumable for non-expert teams.

### 2.4 Easy for teams that do not already know AX

Shift AX is not designed first for operators who enjoy assembling prompt rituals by hand.

It is designed for teams that want:

- a safe default path
- explicit commands
- readable status
- obvious pause/resume points
- clear human review gates

## 3. Architectural shape

At a high level, Shift AX looks like this:

```text
shared docs / base-context
        ↓
context resolution
        ↓
topic + artifact bootstrap
        ↓
planning interview + reviewed spec/plan
        ↓
policy sync gate
        ↓
execution orchestration
        ↓
structured review
        ↓
local finalization / commit

support memory + support state + observability
        ↳ help every step, but never outrank shared docs
```

The repository mirrors that shape:

```text
core/
  context/
  topics/
  planning/
  review/
  finalization/
  memory/
  observability/
  diagnostics/
  policies/

platform/
  codex/
  claude-code/

adapters/
  codex/
  claude-code/

scripts/
  ax command surfaces
```

## 4. Layer-by-layer architecture and borrowed ideas

Shift AX does not try to rebrand one existing system. It selectively borrows ideas and re-grounds them under its own rules.

### 4.1 Product / workflow control-plane layer

**Shift AX philosophy**

- workflow is the product
- guardrails are first-class
- human review gates are explicit
- non-expert teams must be able to follow the path safely

**Borrowed ideas**

- **OMX / OMC**: staged workflow shape such as clarify → plan → execute → verify
- **agent-skills**: workflow discipline, anti-rationalization framing, spec-first execution

**How Shift AX translates those ideas**

- request-to-commit is treated as a formal workflow
- stages are explicit in files and CLI commands
- the workflow can stop, resume, review, and escalate without relying on hidden conversation context

### 4.2 Context grounding layer

**Shift AX philosophy**

- if a relevant document exists, the agent must use it
- the agent must not guess through domain facts that the organization already wrote down

**Borrowed ideas**

- **agent-skills**: context hierarchy
- **mempalace**: onboarding interview structure, room/entity detection for context drafting
- **honcho**: bounded context packaging ideas

**How Shift AX translates those ideas**

- `docs/base-context/index.md` is the top-level routing surface
- onboarding can create or discover shared docs
- glossary seeding and discovery support the docs layer
- `build-context-bundle` and `init-context` create compact, docs-first context bundles
- support recall may be attached later, but never above shared docs

### 4.3 Topic / workspace artifact layer

**Shift AX philosophy**

- every request gets its own file-backed trail
- work should be resumable without relying on memory of the previous chat

**Borrowed ideas**

- **OMX / OMC**: persistent state/log/artifact layout
- **get-shit-done**: file-backed state and handoff discipline

**How Shift AX translates those ideas**

- every request gets a topic directory under `.ax/topics/`
- every topic stores request, summary, context, plan, review, and finalization artifacts
- worktree planning is tied to the topic
- `.ax/STATE.md` and topic `handoff.md` make the current state readable to humans

### 4.4 Planning and human review layer

**Shift AX philosophy**

- the system should reduce ambiguity before implementation
- planning is not complete until a human has approved it

**Borrowed ideas**

- **agent-skills**: spec-first development, planning and task breakdown
- **OMX / OMC**: clarify-first flow and gated progression

**How Shift AX translates those ideas**

- requests are interviewed before planning artifacts are written
- brainstorm, spec, and implementation plan are separate files
- plan approval is explicit and recorded
- stale or conflicting plans are blockable
- if shared policy/base-context docs must change, the system stops for policy sync before implementation

### 4.5 Execution orchestration layer

**Shift AX philosophy**

- short work and long work do not have the same execution shape
- execution should be resumable and observable

**Borrowed ideas**

- **OMX / OMC**: subagent vs tmux execution split
- **agent-orchestrator**: lifecycle/session concepts

**How Shift AX translates those ideas**

- execution handoff and execution state are file-backed
- short slices can map to subagent execution
- long slices can map to tmux-backed execution
- workflow state records execution progress and reopening after downstream feedback

### 4.6 Review and finalization layer

**Shift AX philosophy**

- review is a gate, not a courtesy
- finalization must be evidence-backed

**Borrowed ideas**

- **agent-skills**: review discipline and engineering hygiene
- **OMX / OMC**: verify-before-complete discipline
- **claw-code**: operator-facing practicality

**How Shift AX translates those ideas**

- review lanes are explicit:
  - domain-policy
  - spec-conformance
  - test-adequacy
  - engineering-discipline
  - conversation-trace
- verification evidence is written into topic artifacts
- commit finalization is blocked until gates pass
- final commit messages follow a structured Lore protocol

### 4.7 Support memory and support context layer

**Shift AX philosophy**

- support memory should help recall
- support memory must never become an unofficial second truth system

**Borrowed ideas**

- **mempalace**: lightweight recall and decision continuity concepts
- **honcho**: context bundles, recall ranking, summary/consolidation concepts
- **get-shit-done**: threads, pause-work, readable state, freshness discipline

**How Shift AX translates those ideas**

- past-topic recall
- decision register with validity windows
- learned-debug history
- context monitor snapshots
- summary checkpoints
- verification debt
- threads for cross-topic work
- entity-memory and consolidation as support tools

These tools are intentionally secondary. They exist to support:

- continuity
- operator handoff
- debugging reuse
- long-running work

They must never outrank:

1. base-context docs
2. reviewed spec / implementation plan
3. execution / review artifacts

### 4.8 Operator surface and observability layer

**Shift AX philosophy**

- operators need visibility
- visibility should stay compact until broader rollout pressure proves otherwise

**Borrowed ideas**

- **agent-orchestrator**: lifecycle, session, and observability concepts
- **claw-code**: doctor-first operator ergonomics
- **get-shit-done**: state readability and pause/resume continuity

**How Shift AX translates those ideas**

- `ax doctor`
- `ax topic-status`
- `ax topics-status`
- `ax context-health`
- `ax monitor-context`
- readable `.ax/STATE.md`

Shift AX prefers **compact CLI observability** over a dashboard unless the team truly needs the extra surface area.

## 5. Architectural invariants

These are the rules the architecture is built to protect.

### 5.1 Shared docs win

If shared docs and support memory disagree, shared docs win.

### 5.2 Support layers stay support layers

Threads, summaries, recall bundles, decision memory, and entity views help the operator and the agent, but they do not replace reviewed planning artifacts.

### 5.3 Every important transition becomes an artifact

Shift AX prefers an explicit file over an implied chat state.

### 5.4 Human review happens before and after implementation

- before implementation: plan review
- after implementation: structured review lanes

### 5.5 Easy defaults matter more than clever flexibility

Shift AX intentionally keeps the default operator surface smaller than the total internal capability set.

## 6. Why this architecture fits the product goal

This architecture is designed around one core promise:

> a team that does not already understand AX deeply should still be able to adopt Shift AX safely and get a disciplined request-to-commit flow

That is why the architecture consistently chooses:

- docs over guesswork
- files over hidden chat memory
- gates over “just trust the agent”
- compact operator surfaces over sprawling control panels
- support memory under shared truth, not above it

## 7. Related documents

- [../vision.md](../vision.md)
- [./initial-repo-structure.md](./initial-repo-structure.md)
- [./workflow-skill-contract.md](./workflow-skill-contract.md)
- [../roadmap/source-adoption-backlog.md](../roadmap/source-adoption-backlog.md)
- [../acknowledgements.md](../acknowledgements.md)
