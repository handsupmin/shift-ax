# Objective Eval Framework

Shift AX should be defended with measurable delivery evidence, not only qualitative claims. The objective eval suite measures whether request-to-commit behavior is still objectively safe, complete, and efficient.

## What It Measures

| Category | Metric Examples | Why It Matters |
|---|---|---|
| Context | recall@3, MRR, false positive rate | Proves onboarding context can be found precisely. |
| Planning | ambiguity classification, ready/vague scores | Proves implementation does not start from underspecified requests. |
| Tokens | bundle budget compliance, estimated tokens, reduction percent | Proves context injection is bounded and optimized. |
| Harness | FSM rejection, idempotency, retry recovery, DAG order | Proves LLM calls run inside deterministic rails. |
| Review | allow/block accuracy, required lane coverage, test adequacy blocking | Proves commits are blocked when specs/tests/gates are not satisfied. |
| Artifacts | request-to-plan artifact completeness, plan-review pause | Proves state is stored in files instead of hidden chat memory. |

## Commands

```bash
shift-ax eval --output .shift-ax/evals/latest
shift-ax eval --json
npm run eval:objective
npm run eval:all
```

`shift-ax eval` writes:

- `objective-eval-report.json`
- `objective-eval-report.md`

The command exits with code 1 when any metric misses its threshold, so it can be used as a CI or release gate.

## Current Baseline

The current deterministic fixture baseline is:

- 100% context recall@3 and MRR 1.000
- 0% adversarial false positive rate
- 100% planning readiness classification
- 89% context-token reduction at a 1200 char bundle budget
- 100% deterministic harness checks for FSM, idempotency, retry recovery, and DAG order
- 100% review allow/block accuracy, including missing-test blocking
- 100% request-to-plan artifact completeness
