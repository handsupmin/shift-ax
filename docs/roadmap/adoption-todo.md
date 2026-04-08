# Shift AX Adoption TODO

This TODO list is ordered by direct impact on Shift AX's product goal.

## Immediate

- [x] **Base-context discovery assistant**
  - Scan repo docs/folders and propose a first draft of `docs/base-context/index.md`.
  - Borrow local room/category heuristics from mempalace.
- [x] **Domain glossary seeding**
  - Detect service names, key entities, aliases, and internal vocabulary.
  - Write or update a glossary doc that can be referenced from the base-context index.
- [x] **Native skill contract for Shift AX workflows**
  - Create a standard shape for clarify / plan / implement / review / finalize workflows.
  - Borrow anti-rationalization and verification sections from agent-skills.
- [x] **First-run onboarding refinement**
  - Expand onboarding prompts for business model, policy areas, architecture, and risky domains.
- [x] **Policy-context sync gate before implementation**
  - If planning changes shared domain/policy docs under the base-context index, require those updates and record them before implementation starts.
- [x] **Execution-state-aware review expansion**
  - Continue improving review to reason from execution artifacts, changed files, and test evidence.

## Next

- [x] **Past-topic recall helper**
  - Add a file-backed memory layer for previous topic artifacts, subordinate to authoritative docs.
- [x] **Decision register with validity windows**
  - Track major decisions, effective dates, and replacements.
- [x] **Lifecycle / reaction layer**
  - Add event-driven feedback loops for failed reviews, blocked execution, and future CI handling.
- [x] **Observability surfaces**
  - Add compact operator views for current phase, failure reason, and active task state.
- [x] **Doctor / health diagnostics expansion**
  - Extend environment and runtime checks around launchers, worktrees, and state integrity.

## Later

- [x] **Review / CI feedback reactions**
  - Reopen execution automatically when downstream checks fail.
- [ ] **Dashboard / fleet supervision**
  - Add broader session visibility only if it stays simple for non-expert teams.
- [ ] **Decision-memory search**
  - Add supporting long-term recall across completed topics.
