# Core Orchestration

`core/orchestration` owns deterministic agent workflow control.

LLMs can decide task content or review feedback, but this layer owns the rails:

- finite-state-machine transitions
- local SQLite run/task/event persistence
- priority DAG task claiming
- retry scheduling
- idempotency keys
- executor registration

The execution orchestrator calls agents only through registered executors. State changes, queue selection, retries, and completion checks are script-owned.
