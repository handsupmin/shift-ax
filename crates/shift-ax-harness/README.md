# shift-ax-harness

Rust core for deterministic Shift AX harness rules.

This crate keeps the pure orchestration algorithms separate from LLM judgment:

- finite-state-machine transition validation
- DAG task readiness
- priority ordering
- exponential retry delay

The TypeScript layer owns platform adapters, file artifacts, and SQLite persistence. The Rust layer is intentionally dependency-free so the deterministic core can be tested without agent or network behavior.
