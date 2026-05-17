# Deterministic Harness Architecture

Shift AX treats agentic delivery as a deterministic harness with LLM calls inside it, not as an LLM improvising the workflow.

## Principle

- Traditional algorithms own orchestration: finite-state machines, queues, DAG readiness, retry policy, idempotency, and durable state.
- LLMs own judgment inside bounded tasks: implementation choices, clarification feedback, and review comments.
- Scripts own when an LLM may act, what task it receives, whether its output counts, and what happens after failure.

## Runtime Split

- Rust: dependency-light deterministic core algorithms for FSM transitions, DAG readiness, priority ordering, and retry delay.
- Node/TypeScript: platform adapters, topic artifacts, request pipeline wiring, review gates, and CLI integration.
- Local SQLite: durable run/task/event state in each topic, currently `harness.sqlite`.

## State Machine

Harness runs move through a closed set of phases:

- `initialized`
- `planning`
- `awaiting_plan_review`
- `execution_ready`
- `executing`
- `review_pending`
- `commit_ready`
- `committed`
- `blocked`
- `failed`

Invalid jumps such as `initialized -> committed` are rejected by code.

## Queue And DAG

Execution tasks are persisted before launch. A task can be claimed only when:

- its status is `pending` or `retry_ready`
- its retry delay has elapsed
- all task-id dependencies are `completed`
- it wins deterministic priority ordering

The queue stores idempotency keys so duplicate task materialization does not create duplicate work.

## Agent Boundary

Agent runtimes are executors. They do not choose the next task, mutate the queue, skip review, or mark commit readiness. The harness claims a task, invokes the registered executor, waits for the expected output artifact, and records the outcome.

## Failure Policy

Failures are recorded in SQLite with attempt counts and errors. Retry readiness is computed by deterministic exponential backoff. Exhausted tasks become `failed`, which blocks the run from review and commit.

## Review And Commit

The deterministic harness gets the work to `review_pending`; review lanes then decide whether `commit_allowed=true`. Finalization still requires aggregate review approval and Lore commit message validation.
