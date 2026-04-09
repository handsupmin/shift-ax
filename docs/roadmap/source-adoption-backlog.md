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
  - Keep the first feedback loop compact: one operator command to reopen implementation after downstream failures.
- **Observability**
  - Keep correlation IDs, health summaries, and last-failure reasoning.
  - Provide compact operator surfaces such as `ax topic-status` instead of a heavyweight dashboard.
  - Extend that with a compact multi-topic list (`ax topics-status`) before considering any broader dashboard.

### From claw-code
- **Doctor-first runtime health checks**
  - Make environment validation explicit and easy.
  - Prefer a compact CLI doctor report over a complex dashboard for operator usability.
- **Usage-first documentation**
  - Keep setup and operator docs practical and task-oriented.

### From get-shit-done
- **Readable state file**
  - Add a human-readable `.ax/STATE.md` or topic handoff file that summarizes current phase, blocker, next command, and recent decision.
- **Context-window monitor**
  - Detect when the active session is approaching context exhaustion and warn or checkpoint before quality drops.
- **Pause / handoff command**
  - Add an explicit pause-work surface that writes a structured handoff for later resumption.
- **Threads for cross-topic work**
  - Add `.ax/threads/` for long-running context that does not belong to a single topic.
- **Compound context loader**
  - Provide a lightweight command that assembles the current repo/topic/decision context bundle for a given workflow step.
- **Learned-debug/history notes**
  - Persist resolved failure patterns so future debugging and review can consult them.
- **Profile-free freshness discipline**
  - Keep pushing heavy work into fresh worker contexts instead of letting the leader session accumulate long planning and execution history.

## Adopt next

### From honcho
- **Token-budgeted context bundles**
  - Build a retrieval bundle that combines base-context docs, reviewed artifacts, decision memory, and past-topic recall under an explicit token budget.
- **Hybrid ranking for memory recall**
  - Improve decision/topic recall ranking with a blend of lexical match, recency, and linked-artifact context.
- **Session summaries with thresholds**
  - Add configurable summary checkpoints for long-running work instead of relying only on raw artifact growth.
- **Representation-style recall output**
  - Produce compact "what matters right now" summaries for a topic, reviewer, or operator based on stored artifacts.
- **Background consolidation**
  - Periodically consolidate duplicate decisions, repeated topic outcomes, and glossary candidates into cleaner long-term memory.
- **Scoped search modes**
  - Support workspace/repo/topic/decision-specific search modes instead of one flat recall command.

### From get-shit-done
- **Thread promotion / backlog promotion**
  - Let long-running threads graduate into real topics when they become actionable work.
- **Context health hooks**
  - Add runtime hooks that warn the operator and the agent when context quality is degrading.
- **Workflow init surfaces**
  - Expose a compact init command that gives an execution surface exactly the files and state it needs.
- **User/team preference profile (lightweight)**
  - Capture stable team preferences for implementation and review style, without outranking docs.
- **Verification debt tracking**
  - Track unresolved verification gaps and surfaced-but-deferred review issues across topics.

## Adopt later

### From mempalace
- **Past-topic recall layer**
  - Search prior topic artifacts and decision history after the authoritative docs and reviewed artifacts have been checked first.
- **Decision graph / validity graph**
  - Track when key decisions became active, were replaced, or expired.
  - Search decision memory with linked topic summaries so operators can quickly recall why a decision exists.

### From agent-orchestrator
- **Reactive feedback loops**
  - After request-to-commit is stable, add review-fix / CI-fix reactions as a second loop.
- **Expanded dashboard / fleet observability**
  - Add broader operator visibility only after the core workflow stays simple.

### From OMX / OMC
- **Richer runtime supervision and analytics**
  - Add more status surfaces only where they reduce operator burden without increasing confusion.

### From honcho
- **Asynchronous memory workers**
  - Offload heavier summarization/consolidation passes into background jobs only after the simpler file-backed flow remains predictable.
- **Entity-centric memory views**
  - Add richer representations of users, teams, or services only if real rollout needs demand them.

## Explicitly keep as support-only, not source-of-truth

### mempalace
- Raw transcript memory
- Search-based recall
- Entity / room suggestions

### honcho-style memory layers
- Message-level memory stores
- Session summaries
- Representation outputs
- Semantic recall bundles

### get-shit-done style state layers
- STATE.md summaries
- thread files
- pause/handoff artifacts

These may support:
- base-context draft generation
- glossary suggestions
- similar-topic recall
- decision recall
- operator handoff
- long-running work continuity

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
