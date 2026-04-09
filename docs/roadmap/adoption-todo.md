# Shift AX Adoption TODO

This TODO list is ordered by direct impact on Shift AX's product goal.

## Completed foundations

- [x] Base-context discovery assistant
- [x] Domain glossary seeding
- [x] Native skill contract for Shift AX workflows
- [x] First-run onboarding refinement
- [x] Policy-context sync gate before implementation
- [x] Execution-state-aware review expansion
- [x] Past-topic recall helper
- [x] Decision register with validity windows
- [x] Lifecycle / reaction layer
- [x] Observability surfaces
- [x] Doctor / health diagnostics expansion
- [x] Review / CI feedback reactions
- [x] Dashboard / fleet supervision (compact CLI form)
- [x] Decision-memory search

## Next backlog — high priority

- [x] **Readable state / handoff files**
  - Add `.ax/STATE.md` or topic-level handoff summaries for human-readable current state.
- [x] **Context-window monitor**
  - Warn before context rot becomes dangerous; add warning and critical thresholds.
- [x] **Pause-work / resume handoff**
  - Add an explicit command that writes a safe resume bundle when work must stop mid-flight.
- [x] **Threads for cross-topic context**
  - Add `.ax/threads/` for long-running decisions, migrations, and rollout work that spans multiple topics.
- [x] **Token-budgeted context bundle builder**
  - Generate compact execution/review context bundles that prioritize docs, plans, decisions, and topic recall under a size budget.

## Medium priority

- [x] **Hybrid ranking for topic / decision recall**
  - Blend lexical match, recency, and linked-artifact context to improve retrieval quality.
- [x] **Workflow init / context loader command**
  - Provide a compact command that assembles exactly the current context needed for a workflow step.
- [x] **Verification debt tracking**
  - Track deferred review issues and missing verification work across topics.
- [x] **Learned-debug history**
  - Persist resolved failure patterns so repeated debugging gets faster and more consistent.
- [x] **Session summary checkpoints**
  - Add summary checkpoints for long-running work instead of relying only on raw artifact growth.

## Lower priority / scale-up work

- [x] **Background memory consolidation** *(implemented as an operator support tool first)*
  - Periodically dedupe decisions, promote glossary candidates, and compress repeated topic learnings.
- [x] **Thread promotion into topics** *(implemented as an operator support tool first)*
  - Convert long-running thread context into executable topics when it becomes actionable.
- [x] **Scoped recall modes** *(implemented as a support-layer recall surface)*
  - Add repo/topic/decision-specific recall modes with clearer boundaries.
- [x] **Lightweight team preference profile** *(implemented as a support-layer profile store)*
  - Capture stable implementation/review preferences without outranking docs.
- [x] **Entity-style memory views** *(implemented as a support-layer query view)*
  - Add richer operator/user/service representations only if real rollout pressure justifies them.
