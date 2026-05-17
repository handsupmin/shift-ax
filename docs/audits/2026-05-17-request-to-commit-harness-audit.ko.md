# 2026-05-17 Request-To-Commit Harness Audit

## Verdict

아직 사용자가 요구한 최종 수준은 아니다.

현재 Shift AX는 request, resolved context, spec, implementation plan, execution state, verification, review result, commit state를 파일 artifact로 남기는 request-to-commit 골격은 실제로 갖췄다. 또한 planning readiness와 deterministic independent-review gate가 추가되어, 누락된 실행 증거, 실패한 검증, 미완료 task, stale readiness, plan re-review 누락 같은 workflow 무결성 문제는 꽤 잘 막는다.

하지만 이 상태를 "MAU 30만 프로덕션에 바로 적용 가능한 자동 개발/리뷰 게이트"라고 부르면 과장이다. 현재 리뷰 게이트는 주로 artifact/process integrity gate이고, 남의 코드를 보는 별도 clean-context AI reviewer, semantic code review, 보안/성능/마이그레이션/운영 리스크 검토, reference 수준의 deep onboarding 품질 게이트는 아직 미완성이다.

## Evidence Inspected

- `core/planning/request-pipeline.ts`: context resolution, topic/worktree bootstrap, readiness assessment, plan review, execution, verification, review, optional auto commit 흐름.
- `core/planning/readiness-assessment.ts`: heuristic ambiguity scoring.
- `core/review/run-lanes.ts`: domain-policy, planning-readiness, spec-conformance, test-adequacy, engineering-discipline, conversation-trace, independent-review lane.
- `core/review/independent-review.ts`: clean-file-artifacts-only deterministic gate.
- `core/finalization/commit-workflow.ts`: aggregate review `commit_allowed=true`일 때만 commit.
- `core/context/guided-onboarding.ts`, `core/context/global-index-authoring.ts`: guided onboarding 및 global index 생성.
- `platform/codex/scaffold/prompts/onboard.template.md`, `platform/codex/scaffold/prompts/request.template.md`: runtime shell guidance.
- `/Users/sangmin/downloads/reference/index.md` 및 reference docs.
- `/Users/sangmin/sources/gc-tree/src/onboarding-protocol.ts`.
- `/Users/sangmin/sources/oh-my-codex/skills/deep-interview/SKILL.md`, `ralplan/SKILL.md`, `ralph/SKILL.md`.
- Strict smoke artifacts in `cosmo-backend-g3`, `cosmo-admin-g3`, `db-migration`.

## Requirement Matrix

| Requirement | Current Status | Judgment |
|---|---:|---|
| Global onboarding with AI-led 1/2/3 confirmation | Partial | `guided-onboarding.ts` asks staged questions and has repo hypothesis confirmation. It does shallow bounded inspection and writes global docs. It does not yet match gc-tree's reference-doc-first, category-rich, self-healing verification protocol. |
| Global docs outside a repo | Mostly yes | Default home is global and docs are written under `~/.shift-ax`. Smoke used `/tmp/shift-ax-cosmo-smoke/home`. |
| Index as `link:[keywords]` / path-with-keywords retrieval surface | Partial / mismatch | Current Shift AX index is `label -> path` grouped by Role, Work Types, Repositories, Procedures, Domain Language. Reference gc-tree index is path-first with many keywords per doc and richer categories. |
| Onboarding review gate | Weak / missing | `qualityIssues` exists in authoring result but is not populated with real category, summary, index-density, coverage, or verification issues. There is no `verify-onboarding` equivalent. |
| Reference docs under `sangmin/downloads/reference` fully used | No | Smoke onboarding captured only a thin subset. It missed many reference categories and docs such as infra, verification, airflow, dev-ops-v2, DTO strategy, scheduled jobs, and room broadcaster domain docs. |
| PRD deep interview like Ouroboros/OMX | Partial | CLI has fixed planning prompts plus heuristic readiness scoring. It does not run a Socratic loop with one high-leverage question per round, fact-vs-decision routing, pressure passes, mandatory non-goals/decision-boundary gates, or thresholded ambiguity rounds like `deep-interview`. |
| Ambiguity scoring blocks implementation | Yes, but heuristic | `assessTopicPlanningReadiness` recomputes before implementation and blocks unclear artifacts. Scoring is text-signal based, not model-evaluated semantic ambiguity. |
| TDD implementation with clean architecture conventions | Partial | Plans must mention TDD/architecture and tests, and test-adequacy expects a passing test command plus changed tests for changed code. The gate cannot prove actual clean architecture, coupling/cohesion quality, or meaningful variable naming. |
| Autonomous execution | Partial | `--platform codex|claude-code` can orchestrate execution tasks through adapters. The strict smoke was manually prepared/assisted and tiny, not proof of robust autonomous production feature work. |
| Separate clean-context review agent | No | The product has a deterministic independent-review gate with `reviewer_context: clean-file-artifacts-only`. It does not currently spawn a truly separate AI reviewer with fresh context to inspect the diff like an external reviewer. |
| Review gate prevents obvious missing evidence | Yes | Independent review blocks missing changed files, missing/incomplete execution, failed verification, missing plan approval, and non-ready planning. Regression tests cover no changed-file evidence and incomplete execution tasks. |
| Review gate catches semantic production defects | Not enough | It does not parse code deeply, reason over business rules, enforce security/perf/data-migration/API compatibility, or run a true reviewer model. |
| File-backed artifacts | Yes | Request, summary, resolved context, readiness, brainstorm, spec, implementation plan, plan review, execution, verification, review, commit message/state are persisted. |
| Commit only after gates pass | Mostly yes | `finalizeTopicCommit` requires aggregate review `commit_allowed=true`. `resumeRequestPipeline` auto-commits only after aggregate approval when `autoCommit` is enabled. |
| 300k MAU production applicability | No as-is | Suitable as a pilot/local guardrail harness for low/medium-risk work with human review and CI. Not enough as the only production gate for high-risk services. |

## Review Gate Level

Current gate level: **L1.5 workflow-integrity gate**.

It reliably asks:

- Is there an approved, fingerprint-matched plan?
- Is planning readiness currently `ready`?
- Are base-context paths resolved?
- Did execution produce changed-file evidence?
- Are all execution tasks completed?
- Did verification commands pass?
- Did changed code have changed tests?
- Are request, brainstorm, spec, plan, and execution result traceable by rough token overlap?

It does not yet reliably ask:

- Is the implementation actually correct for production behavior?
- Did it preserve domain invariants from company docs?
- Is the architecture clean, cohesive, and low-coupled in code, not only in plan text?
- Are security, privacy, auth, rate limit, transactionality, observability, rollback, migration safety, and performance risks acceptable?
- Would a fresh senior reviewer approve this diff?
- Did the tests meaningfully fail before the code and cover edge cases?

So the current review gate is useful and real, but it is not yet the "separate senior AI reviewer for production code" gate the user described.

## Onboarding Gap

The reference gc-tree onboarding protocol is materially stricter than the current Shift AX onboarding:

- It starts from provided docs/reference material first.
- It distinguishes global onboarding from repo-local onboarding.
- It samples repo code concretely: controller/route, service/use-case, DTO/schema.
- It writes category-rich docs: role, repos, domain, workflows, conventions, infra, verification.
- It writes actionable summaries, not table-of-contents summaries.
- It creates path-first index entries with dense bilingual keywords.
- It runs `verify-onboarding`.
- It self-heals category, summary, and index coverage issues until clean.
- It asks a final numbered coverage confirmation before claiming completion.

Shift AX currently:

- Asks useful staged questions and provides 1/2/3 repo confirmation.
- Inspects repo paths shallowly and infers rough architecture/convention hints.
- Writes global docs, but categories are limited to role, work-types, repos, procedures, domain-language.
- Generates `label -> path` index entries with a few aliases.
- Does not verify index density, category completeness, actionable summaries, bilingual retrieval, or full reference coverage.

For the user's desired onboarding, this is not enough.

## Reference Adoption Gap

The repo acknowledges and documents ideas from OMX/OMC, gc-tree-like onboarding, and other sources. But "참고했다"와 "제품 동작으로 흡수했다"는 다르다.

Adopted in code:

- Stage-based request-to-commit flow.
- File-backed topic artifacts.
- Planning readiness score.
- Structured review lanes.
- Execution state and verification evidence.
- Commit gate.
- Some onboarding 1/2/3 confirmation.

Not fully adopted:

- gc-tree onboarding completion/verification protocol.
- gc-tree path-first dense keyword index format.
- Ouroboros/OMX deep-interview Socratic loop.
- Ralplan multi-agent Planner/Architect/Critic consensus planning.
- Ralph-style persistent completion audit with true architect signoff and retry loop.
- Independent review by a fresh AI agent.

## Smoke Test Interpretation

Strict smoke across `cosmo-backend-g3`, `cosmo-admin-g3`, and `db-migration` proved that the new gates can pass when artifacts are prepared correctly:

- independent-review status: `approved`
- execution task count: `1`
- completed task count: `1`
- incomplete task count: `0`
- verification command count: `2`
- failing command count: `0`
- local commits were created in the strict worktrees

However, those tasks were smoke markers, not real production work. They prove artifact wiring and gate mechanics, not product-grade delivery quality.

## Production Readiness Judgment

Do not market or use the current state as an autonomous 300k MAU production gate.

Reasonable current positioning:

- Good enough for an internal pilot.
- Good enough to enforce artifact discipline.
- Good enough to prevent several common "declared done without evidence" failures.
- Useful as a pre-PR local harness for small, reversible changes.

Not yet enough for:

- sole merge gate on production-critical services
- high-risk DB migrations
- auth/payment/security-sensitive changes
- cross-repo behavioral changes without a human reviewer
- replacing CI, code owner review, security review, or architecture review

The existing pilot plan is the right bar: 2-week pilot, 5-10 real requests, at least one real blocked gate, at least one feedback reopen, real runtime success per platform, and reviewed base-context docs.

## Required Remediation To Meet The User's Target

1. **Build real onboarding verification.**
   Add a `verify-onboarding` style gate for category coverage, actionable summaries, dense index entries, bilingual keywords, linked-file existence, related repo coverage, workflow/convention/verification docs, and final coverage confirmation.

2. **Support reference-doc ingestion.**
   Add an onboarding path that can import a directory like `/Users/sangmin/downloads/reference`, preserve its category structure, and produce a Shift AX index equivalent to the gc-tree reference index.

3. **Change index shape or support both shapes.**
   Add path-first `path -> keywords` or `path:[keywords]` rendering while keeping compatibility with current `label -> path` resolver if needed.

4. **Replace fixed planning prompts with a deep-interview loop.**
   Implement one-question-at-a-time clarification with dimension scoring, code-fact discovery before user questions, non-goals and decision-boundary gates, pressure passes, and threshold-based stop conditions.

5. **Add real clean-context reviewer execution.**
   Create a review handoff that launches a separate Codex/Claude reviewer context, passes only artifacts/diff/evidence, requires structured findings, and merges that verdict with deterministic lanes.

6. **Raise review depth.**
   Add semantic review dimensions for correctness, architecture/layering, security/privacy, data migration, API compatibility, observability, rollback, performance, and test meaningfulness.

7. **Dogfood with a real cross-repo task.**
   Run a non-trivial request touching `cosmo-backend-g3`, `cosmo-admin-g3`, and/or `db-migration`, with actual TDD, full repo-appropriate verification, reviewer findings, fixes, and final commit.

8. **Keep claims honest until pilot passes.**
   README/product copy should avoid implying production-grade autonomous review until the above gates exist and the pilot success criteria pass.

## Final Call

The implementation is real in the sense that file-backed request-to-commit workflow and evidence gates exist. It is not real yet in the stronger sense the user asked for: "onboarding like gc-tree, deep interview like Ouroboros/OMX, ralplan/ralph-style implementation discipline, separate clean-context reviewer, production-grade review gate."

Current state: **strong prototype / pilot harness**.

Target state: **production-grade request-to-commit harness**.

Gap: **significant, especially onboarding verification, deep interview, and true independent semantic review**.
