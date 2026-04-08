# Shift AX Source Adoption Backlog

This document records which ideas from external repos are worth absorbing into Shift AX.

## Product guardrails

Everything adopted here must preserve two non-negotiable goals:

1. **Easy, simple, intuitive operation** for teams that are not already fluent in AX workflows.
2. **Strict adherence to Shift AX philosophy**:
   - base-context index and linked markdown docs are the primary source of truth
   - no guessing when a relevant document exists
   - brainstorming and human plan review happen before development
   - engineering methods are enforced during implementation
   - review and commit are file-backed, auditable workflow gates

## Adopt now

### From agent-skills
- **Skill anatomy / workflow template**
  - Use a single format for every Shift AX workflow: trigger, process, anti-rationalization, verification, exit criteria.
- **Context engineering hierarchy**
  - Keep `docs/base-context/index.md` and linked docs at the top of the context order.
- **Spec-first development**
  - Preserve the rule that reviewed plan/spec artifacts exist before execution.
- **Planning and task breakdown**
  - Keep implementation tasks small, ordered, and testable.
- **Incremental implementation**
  - Build in thin slices and leave the repo in a working state after every slice.
- **Review discipline**
  - Continue expanding code-aware review against correctness, architecture, tests, and scope.
- **Git workflow discipline**
  - Preserve small, reviewable, reversible changes and strong commit hygiene.

### From mempalace
- **Onboarding interview structure**
  - Use first-run questions to capture business context, domain vocabulary, policy areas, and architecture references.
- **Room detection**
  - Use local folder/file heuristics to propose categories for the base-context index.
- **Entity detection**
  - Extract service names, domain terms, aliases, and internal vocabulary into glossary/index suggestions.
- **Transcript normalization**
  - Normalize past conversation exports or notes into a consistent shape for later topic recall.
- **Search / recall concepts**
  - Use memory recall only as a supporting lookup beneath authoritative docs.
- **Temporal decision memory (lightweight)**
  - Keep a simple file-backed record of decisions and when they became valid.

### From OMX / OMC
- **Clarify → plan → execute → verify shape**
  - Keep Shift AX workflows stage-based and explicit.
- **Persistent state and traces**
  - Store plans, state, logs, and memory under `.ax/`.
- **Execution mode split**
  - Keep short work on subagents and long work on tmux-backed execution.
- **Operator surfaces**
  - Maintain setup / doctor / cancel / trace style support commands.

### From agent-orchestrator
- **Lifecycle manager concepts**
  - Model clear execution states and transitions.
- **Session manager concepts**
  - Track topic/session metadata and resumability cleanly.
- **Reaction / event model**
  - Future-proof review/CI feedback loops.
- **Observability**
  - Keep correlation IDs, health summaries, and last-failure reasoning.
  - Provide compact operator surfaces such as `ax topic-status` instead of a heavyweight dashboard.

### From claw-code
- **Doctor-first runtime health checks**
  - Make environment validation explicit and easy.
  - Prefer a compact CLI doctor report over a complex dashboard for operator usability.
- **Usage-first documentation**
  - Keep setup and operator docs practical and task-oriented.

## Adopt later

### From mempalace
- **Past-topic recall layer**
  - Search prior topic artifacts and decision history after the authoritative docs and reviewed artifacts have been checked first.
- **Decision graph / validity graph**
  - Track when key decisions became active, were replaced, or expired.

### From agent-orchestrator
- **Reactive feedback loops**
  - After request-to-commit is stable, add review-fix / CI-fix reactions as a second loop.
- **Expanded dashboard / fleet observability**
  - Add broader operator visibility only after the core workflow stays simple.

### From OMX / OMC
- **Richer runtime supervision and analytics**
  - Add more status surfaces only where they reduce operator burden without increasing confusion.

## Explicitly keep as support-only, not source-of-truth

### mempalace
- Raw transcript memory
- Search-based recall
- Entity / room suggestions

These may support:
- base-context draft generation
- glossary suggestions
- similar-topic recall
- decision recall

They must never outrank:
1. base-context docs
2. reviewed spec / implementation plan
3. execution / review artifacts

## Working rule for every adoption

Only import an idea if it directly improves at least one of these:
- easier first-run onboarding
- more reliable document grounding
- cleaner planning and review gates
- lower operator burden
- better traceability with minimal complexity
