import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildContextBundle } from '../context/context-bundle.js';
import { onboardProjectContext } from '../context/onboarding.js';
import { resolveContextFromIndex } from '../context/index-resolver.js';
import { ShiftAxHarnessStore } from '../orchestration/harness-store.js';
import { runHarnessQueue } from '../orchestration/harness-runner.js';
import { assessPlanningReadiness } from '../planning/readiness-assessment.js';
import { startRequestPipeline } from '../planning/request-pipeline.js';
import { aggregateReviewVerdicts } from '../review/aggregate-reviews.js';
import { runReviewLanes } from '../review/run-lanes.js';

export type ObjectiveMetricComparator = 'gte' | 'lte' | 'eq';
export type ObjectiveMetricStatus = 'passed' | 'failed';
export type ObjectiveEvalStatus = 'passed' | 'failed';

export interface ObjectiveEvalMetric {
  id: string;
  category: string;
  label: string;
  value: number;
  unit: 'ratio' | 'percent' | 'count' | 'chars' | 'tokens' | 'ms';
  threshold: number;
  comparator: ObjectiveMetricComparator;
  status: ObjectiveMetricStatus;
  evidence: string;
}

export interface ObjectiveEvalScenario {
  id: string;
  title: string;
  status: ObjectiveEvalStatus;
  duration_ms: number;
  metrics: ObjectiveEvalMetric[];
}

export interface ObjectiveEvalReport {
  version: 1;
  suite: 'shift-ax-objective-eval';
  generated_at: string;
  overall_status: ObjectiveEvalStatus;
  score_percent: number;
  metric_count: number;
  passed_metrics: number;
  failed_metrics: number;
  scenarios: ObjectiveEvalScenario[];
}

export interface RunObjectiveEvalSuiteInput {
  outputDir?: string;
  tokenBudgetChars?: number;
  now?: Date;
}

function compareMetric(value: number, comparator: ObjectiveMetricComparator, threshold: number): boolean {
  if (comparator === 'gte') return value >= threshold;
  if (comparator === 'lte') return value <= threshold;
  return value === threshold;
}

function metric(input: Omit<ObjectiveEvalMetric, 'status'>): ObjectiveEvalMetric {
  return {
    ...input,
    value: Number(input.value.toFixed(input.unit === 'count' || input.unit === 'chars' || input.unit === 'tokens' ? 0 : 3)),
    status: compareMetric(input.value, input.comparator, input.threshold) ? 'passed' : 'failed',
  };
}

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempGlobalHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempDir('shift-ax-objective-home-', async (home) => {
    const previous = process.env.SHIFT_AX_HOME;
    process.env.SHIFT_AX_HOME = home;
    try {
      return await fn(home);
    } finally {
      if (previous === undefined) delete process.env.SHIFT_AX_HOME;
      else process.env.SHIFT_AX_HOME = previous;
    }
  });
}

async function scenario(
  id: string,
  title: string,
  fn: () => Promise<ObjectiveEvalMetric[]>,
): Promise<ObjectiveEvalScenario> {
  const started = performance.now();
  const metrics = await fn();
  return {
    id,
    title,
    duration_ms: Number((performance.now() - started).toFixed(1)),
    status: metrics.every((item) => item.status === 'passed') ? 'passed' : 'failed',
    metrics,
  };
}

async function buildResolverCorpus(root: string): Promise<string> {
  const docs = {
    'auth-policy.md': '# Auth Policy\n\nRefresh token rotation, session expiry, and auth verification rules.\n',
    'payment-idempotency.md': '# Payment Idempotency\n\nPayment retry keys, webhook duplicate handling, and idempotency guards.\n',
    'migration-safety.md': '# Migration Safety\n\nDatabase migration rollback, backward compatibility, and release sequencing.\n',
    'admin-resource.md': '# Admin Resource\n\nReact Admin resource wiring, filters, list, edit, and show views.\n',
    'worker-queue.md': '# Worker Queue\n\nBullMQ queue routing, retries, dead letter handling, and worker observability.\n',
  };
  await mkdir(join(root, 'work-types'), { recursive: true });
  for (const [file, content] of Object.entries(docs)) {
    await writeFile(join(root, 'work-types', file), content, 'utf8');
  }
  const indexPath = join(root, 'index.md');
  await writeFile(
    indexPath,
    [
      '# Shift AX Eval Index',
      '',
      '## Work Types',
      '',
      '- Auth policy -> work-types/auth-policy.md',
      '- Payment idempotency -> work-types/payment-idempotency.md',
      '- Migration safety -> work-types/migration-safety.md',
      '- Admin resource -> work-types/admin-resource.md',
      '- Worker queue -> work-types/worker-queue.md',
      '',
    ].join('\n'),
    'utf8',
  );
  return indexPath;
}

async function evalContextRetrieval(): Promise<ObjectiveEvalMetric[]> {
  return withTempDir('shift-ax-objective-context-', async (root) => {
    const indexPath = await buildResolverCorpus(root);
    const cases = [
      ['refresh token rotation auth session', 'Auth policy'],
      ['payment webhook duplicate retry idempotency', 'Payment idempotency'],
      ['database migration rollback compatibility', 'Migration safety'],
      ['react admin resource list edit show', 'Admin resource'],
      ['worker queue retries dead letter observability', 'Worker queue'],
    ] as const;

    let hits = 0;
    let reciprocalRankSum = 0;
    for (const [query, expected] of cases) {
      const result = await resolveContextFromIndex({ rootDir: root, indexPath, query, maxMatches: 3 });
      const rank = result.matches.findIndex((match) => match.label === expected);
      if (rank >= 0) {
        hits += 1;
        reciprocalRankSum += 1 / (rank + 1);
      }
    }

    const irrelevant = await resolveContextFromIndex({
      rootDir: root,
      indexPath,
      query: 'zzzz qwerty unrelated',
      maxMatches: 3,
    });
    const falsePositiveRate = irrelevant.matches.length > 0 ? 1 : 0;

    return [
      metric({
        id: 'context.recall_at_3',
        category: 'context',
        label: 'Context resolver recall@3',
        value: hits / cases.length,
        unit: 'ratio',
        threshold: 0.95,
        comparator: 'gte',
        evidence: `${hits}/${cases.length} labeled queries returned the expected document.`,
      }),
      metric({
        id: 'context.mrr',
        category: 'context',
        label: 'Context resolver mean reciprocal rank',
        value: reciprocalRankSum / cases.length,
        unit: 'ratio',
        threshold: 0.9,
        comparator: 'gte',
        evidence: 'Expected documents should appear near the top, not merely somewhere in the bundle.',
      }),
      metric({
        id: 'context.false_positive_rate',
        category: 'context',
        label: 'Context resolver false positive rate',
        value: falsePositiveRate,
        unit: 'ratio',
        threshold: 0,
        comparator: 'lte',
        evidence: `${irrelevant.matches.length} matches for an adversarial unrelated query.`,
      }),
    ];
  });
}

async function evalPlanningReadiness(): Promise<ObjectiveEvalMetric[]> {
  const ready = assessPlanningReadiness({
    request: 'Add auth refresh token rotation with tests.',
    matchedContextLabels: ['Auth policy'],
    brainstormContent: [
      '# Brainstorm',
      '',
      '## Clarified Outcome',
      'Add refresh token rotation for src/auth/session.ts.',
      '## Constraints',
      'Must keep existing login API compatible and avoid DB schema changes.',
      '## Verification Expectations',
      'Run npm test and npm run build.',
      '## Relevant Context',
      '- Auth policy',
    ].join('\n'),
    specContent: [
      '# Topic Spec',
      '',
      '## Goal',
      'Implement auth refresh token rotation in src/auth/session.ts.',
      '## Constraints',
      'No API shape change. No migration.',
      '## Out of Scope',
      'Do not touch payment or admin resources.',
      '## Verification Expectations',
      'npm test, npm run build',
      '## Relevant Context',
      '- Auth policy',
    ].join('\n'),
    implementationPlanContent: [
      '# Implementation Plan',
      '',
      '## Acceptance Criteria',
      '- Refresh token rotation succeeds and old refresh tokens are rejected.',
      '## Verification Commands',
      '- npm test',
      '- npm run build',
      '## Dependencies',
      '- Auth policy',
      '## Likely Files Touched',
      '- src/auth/session.ts',
      '- tests/auth/session.test.ts',
      '## Checkpoints',
      '- Keep scope inside auth refresh.',
      '## Execution Tasks',
      '1. Add failing test for token reuse.',
      '2. Implement the focused change.',
      '3. Run verification commands.',
      '## Anti-Rationalization Guardrails',
      '- Do not widen scope beyond auth refresh.',
    ].join('\n'),
    now: new Date('2026-05-18T00:00:00.000Z'),
  });
  const vague = assessPlanningReadiness({
    request: 'Make auth better.',
    matchedContextLabels: [],
    brainstormContent: '# Brainstorm\n\nNeed improve auth.\n',
    specContent: '# Topic Spec\n\n## Goal\n\nImprove auth.\n',
    implementationPlanContent: '# Implementation Plan\n\n## Acceptance Criteria\n\n- Better auth.\n',
    now: new Date('2026-05-18T00:00:00.000Z'),
  });
  const correct = Number(ready.status === 'ready') + Number(vague.status === 'needs_clarification');

  return [
    metric({
      id: 'planning.classification_accuracy',
      category: 'planning',
      label: 'Planning readiness classification accuracy',
      value: correct / 2,
      unit: 'ratio',
      threshold: 1,
      comparator: 'eq',
      evidence: `ready=${ready.status} ambiguity=${ready.ambiguity_score}; vague=${vague.status} ambiguity=${vague.ambiguity_score}.`,
    }),
    metric({
      id: 'planning.ready_ambiguity_score',
      category: 'planning',
      label: 'Ready spec ambiguity score',
      value: ready.ambiguity_score,
      unit: 'ratio',
      threshold: 0.2,
      comparator: 'lte',
      evidence: 'Concrete goal, constraints, success criteria, context, and scope should be implementation-ready.',
    }),
    metric({
      id: 'planning.vague_ambiguity_score',
      category: 'planning',
      label: 'Vague spec ambiguity score',
      value: vague.ambiguity_score,
      unit: 'ratio',
      threshold: 0.2,
      comparator: 'gte',
      evidence: 'Underspecified requests must stay above the readiness threshold and block implementation.',
    }),
  ];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function evalTokenEfficiency(tokenBudgetChars: number): Promise<ObjectiveEvalMetric[]> {
  return withTempDir('shift-ax-objective-token-', async (root) => {
    await mkdir(join(root, 'docs', 'base-context', 'procedures'), { recursive: true });
    const repeatedPolicy = Array.from({ length: 28 }, (_, index) =>
      `Rule ${index + 1}: auth refresh, payment idempotency, migration safety, rollback, test evidence, and review gate details must remain explicit.`,
    ).join('\n');
    const docs = [
      ['Auth policy', 'procedures/auth-policy.md', repeatedPolicy],
      ['Payment idempotency', 'procedures/payment-idempotency.md', repeatedPolicy],
      ['Migration safety', 'procedures/migration-safety.md', repeatedPolicy],
      ['Admin resource', 'procedures/admin-resource.md', repeatedPolicy],
    ] as const;
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      [
        '# Base Context',
        '',
        '## Procedures',
        '',
        ...docs.map(([label, path]) => `- ${label} -> docs/base-context/${path}`),
        '',
      ].join('\n'),
      'utf8',
    );
    for (const [, path, content] of docs) {
      await writeFile(join(root, 'docs', 'base-context', path), content, 'utf8');
    }

    const bundle = await buildContextBundle({
      rootDir: root,
      query: 'auth refresh payment idempotency migration safety rollback review gate',
      maxChars: tokenBudgetChars,
    });
    const reductionPct = 1 - bundle.rendered.length / Math.max(bundle.total_source_chars, 1);

    return [
      metric({
        id: 'token.budget_compliance',
        category: 'tokens',
        label: 'Context bundle stays inside configured char budget',
        value: bundle.rendered.length,
        unit: 'chars',
        threshold: tokenBudgetChars,
        comparator: 'lte',
        evidence: `rendered_chars=${bundle.rendered.length}, max_chars=${tokenBudgetChars}.`,
      }),
      metric({
        id: 'token.estimated_tokens',
        category: 'tokens',
        label: 'Estimated prompt tokens after bundling',
        value: estimateTokens(bundle.rendered),
        unit: 'tokens',
        threshold: Math.ceil(tokenBudgetChars / 4),
        comparator: 'lte',
        evidence: `estimated_tokens=${estimateTokens(bundle.rendered)}, source_estimated_tokens=${Math.ceil(bundle.total_source_chars / 4)}.`,
      }),
      metric({
        id: 'token.reduction_pct',
        category: 'tokens',
        label: 'Context token reduction against raw matched sources',
        value: reductionPct * 100,
        unit: 'percent',
        threshold: 50,
        comparator: 'gte',
        evidence: `source_chars=${bundle.total_source_chars}, rendered_chars=${bundle.rendered.length}.`,
      }),
    ];
  });
}

async function evalHarnessDeterminism(): Promise<ObjectiveEvalMetric[]> {
  return withTempDir('shift-ax-objective-harness-', async (root) => {
    const store = new ShiftAxHarnessStore(join(root, 'harness.sqlite'));
    await store.initialize();
    const run = store.createRun({
      runId: 'objective-run',
      topicDir: join(root, '.shift-ax', 'topics', 'objective'),
      idempotencyKey: 'objective-run',
      now: new Date('2026-05-18T00:00:00.000Z'),
    });
    const duplicate = store.createRun({
      runId: randomUUID(),
      topicDir: join(root, '.shift-ax', 'topics', 'objective'),
      idempotencyKey: 'objective-run',
      now: new Date('2026-05-18T00:00:01.000Z'),
    });

    let rejectedInvalidTransition = 0;
    try {
      store.transitionRun({ runId: run.run_id, to: 'committed', reason: 'skip gates' });
    } catch {
      rejectedInvalidTransition = 1;
    }

    store.transitionRun({ runId: run.run_id, to: 'execution_ready', reason: 'objective eval' });
    store.transitionRun({ runId: run.run_id, to: 'executing', reason: 'objective eval' });
    store.enqueueTasks({
      runId: run.run_id,
      now: new Date('2026-05-18T00:00:01.000Z'),
      tasks: [
        { task_id: 'task-a', task_kind: 'script', priority: 1, max_attempts: 2 },
        { task_id: 'task-b', task_kind: 'script', priority: 5, dependencies: ['task-a'] },
      ],
    });

    const order: string[] = [];
    let failedOnce = false;
    await runHarnessQueue({
      store,
      runId: run.run_id,
      workerId: 'objective-eval',
      retryBaseDelayMs: 0,
      maxSteps: 5,
      executors: {
        script: async (task) => {
          order.push(task.task_id);
          if (task.task_id === 'task-a' && !failedOnce) {
            failedOnce = true;
            throw new Error('transient objective failure');
          }
        },
      },
      now: () => new Date('2026-05-18T00:00:02.000Z'),
    });

    return [
      metric({
        id: 'harness.invalid_transition_rejection',
        category: 'harness',
        label: 'FSM rejects invalid commit transition',
        value: rejectedInvalidTransition,
        unit: 'count',
        threshold: 1,
        comparator: 'eq',
        evidence: 'initialized -> committed must throw instead of silently skipping gates.',
      }),
      metric({
        id: 'harness.idempotency_guard',
        category: 'harness',
        label: 'Run idempotency returns the original run',
        value: duplicate.run_id === run.run_id ? 1 : 0,
        unit: 'count',
        threshold: 1,
        comparator: 'eq',
        evidence: `original=${run.run_id}, duplicate=${duplicate.run_id}.`,
      }),
      metric({
        id: 'harness.retry_recovery',
        category: 'harness',
        label: 'Transient task failure recovers through retry',
        value: store.getTask(run.run_id, 'task-a').status === 'completed' ? 1 : 0,
        unit: 'count',
        threshold: 1,
        comparator: 'eq',
        evidence: `task-a attempts=${store.getTask(run.run_id, 'task-a').attempt_count}, order=${order.join('>')}.`,
      }),
      metric({
        id: 'harness.dag_order',
        category: 'harness',
        label: 'DAG dependency order is deterministic',
        value: order.join('>') === 'task-a>task-a>task-b' ? 1 : 0,
        unit: 'count',
        threshold: 1,
        comparator: 'eq',
        evidence: `observed_order=${order.join('>')}.`,
      }),
    ];
  });
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

async function createGitRepo(root: string): Promise<void> {
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Shift AX Eval']);
  git(root, ['config', 'user.email', 'eval@shift-ax.test']);
  await writeFile(join(root, 'README.md'), '# eval repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.shift-ax/\n', 'utf8');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'init']);
}

async function createReviewTopic(root: string, mode: 'good' | 'missing-tests'): Promise<string> {
  const topicDir = join(root, mode);
  const reviewDir = join(topicDir, 'review');
  const worktreePath = join(topicDir, 'worktree');
  await mkdir(reviewDir, { recursive: true });
  await mkdir(join(worktreePath, 'src'), { recursive: true });
  await mkdir(join(worktreePath, 'tests'), { recursive: true });
  await mkdir(join(topicDir, 'execution-results'), { recursive: true });
  await mkdir(join(topicDir, 'final'), { recursive: true });

  await writeFile(join(topicDir, 'request.md'), 'Build safer auth refresh flow\n', 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), 'Need a reviewed auth refresh delivery flow.\n', 'utf8');
  await writeFile(
    join(topicDir, 'resolved-context.json'),
    JSON.stringify({ version: 1, request: 'Build safer auth refresh flow', matches: [{ label: 'Auth policy', path: 'docs/base-context/auth-policy.md' }], unresolved_paths: [] }, null, 2),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'brainstorm.md'),
    '# Brainstorm\n\n## Clarified Outcome\n\nClarified auth refresh rotation.\n\n## Relevant Context\n\n- Auth policy\n',
    'utf8',
  );
  await writeFile(
    join(topicDir, 'spec.md'),
    [
      '# Topic Spec',
      '',
      '## Goal',
      '',
      'Implement auth refresh token rotation.',
      '',
      '## Out of Scope',
      '',
      '- Payment changes',
      '',
      '## Relevant Context',
      '',
      '- Auth policy',
      '',
      '## Verification Expectations',
      '',
      '- npm test',
    ].join('\n'),
    'utf8',
  );
  const plan = [
    '# Implementation Plan',
    '',
    '## Acceptance Criteria',
    '',
    '- Auth refresh rotation works safely.',
    '',
    '## Verification Commands',
    '',
    '- npm test',
    '- npm run build',
    '',
    '## Dependencies',
    '',
    '- Auth policy',
    '',
    '## Likely Files Touched',
    '',
    '- src/auth-refresh.ts',
    ...(mode === 'good' ? ['- tests/auth-refresh.test.ts'] : []),
    '',
    '## Checkpoints',
    '',
    '- Keep the scope inside auth refresh.',
    '',
    '## Execution Tasks',
    '',
    '1. Use TDD first for auth refresh rotation behavior.',
    '2. Keep files small and respect architecture boundaries.',
    '3. Add tests for auth refresh rotation behavior.',
    '4. Include verification steps before local commit finalization.',
    '',
    '## Optional Coordination Notes',
    '',
    '- Short slices should use subagent execution.',
    '',
    '## Execution Lanes (Optional)',
    '',
    '- None recorded.',
    '',
    '## Anti-Rationalization Guardrails',
    '',
    '- Do not widen scope beyond the reviewed request.',
    '- Reproduce unexpected failures before fixing them and add a regression guard.',
  ].join('\n');
  await writeFile(join(topicDir, 'implementation-plan.md'), `${plan}\n`, 'utf8');
  await writeFile(
    join(topicDir, 'plan-review.json'),
    JSON.stringify({
      version: 1,
      status: 'approved',
      reviewer: 'Objective Eval',
      reviewed_at: new Date('2026-05-18T00:00:00.000Z').toISOString(),
      approved_plan_fingerprint: {
        plan_path: 'implementation-plan.md',
        sha256: createHash('sha256').update(`${plan}\n`).digest('hex'),
      },
    }, null, 2),
    'utf8',
  );

  git(worktreePath, ['init', '--initial-branch=main']);
  git(worktreePath, ['config', 'user.name', 'Shift AX Eval']);
  git(worktreePath, ['config', 'user.email', 'eval@shift-ax.test']);
  await writeFile(join(worktreePath, 'README.md'), '# worktree\n', 'utf8');
  git(worktreePath, ['add', 'README.md']);
  git(worktreePath, ['commit', '-m', 'init']);
  await writeFile(join(worktreePath, 'src', 'auth-refresh.ts'), 'export const refresh = true;\n', 'utf8');
  const changedFiles = ['src/auth-refresh.ts'];
  if (mode === 'good') {
    await writeFile(
      join(worktreePath, 'tests', 'auth-refresh.test.ts'),
      "import { test } from 'node:test';\ntest('auth refresh rotation follows auth policy', () => {});\n",
      'utf8',
    );
    changedFiles.push('tests/auth-refresh.test.ts');
  }
  git(worktreePath, ['add', ...changedFiles]);

  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify({
      version: 1,
      topic_slug: `objective-${mode}`,
      phase: 'review_pending',
      created_at: new Date('2026-05-18T00:00:00.000Z').toISOString(),
      updated_at: new Date('2026-05-18T00:00:00.000Z').toISOString(),
      plan_review_status: 'approved',
      worktree: { branch_name: `shift-ax/objective-${mode}`, worktree_path: worktreePath, base_branch: 'main' },
      verification: [{ command: 'npm test', source: 'local', exit_code: 0, stdout: 'ok', stderr: '' }],
    }, null, 2),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'worktree-state.json'),
    JSON.stringify({ version: 1, status: 'created', branch_name: `shift-ax/objective-${mode}`, worktree_path: worktreePath, base_branch: 'main' }, null, 2),
    'utf8',
  );
  const outputPath = join(topicDir, 'execution-results', 'task-1.json');
  await writeFile(
    outputPath,
    JSON.stringify({
      changed_files: changedFiles,
      summary: `Updated ${changedFiles.join(' and ')} for auth policy refresh rotation.`,
    }, null, 2),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'execution-state.json'),
    JSON.stringify({
      version: 1,
      overall_status: 'completed',
      tasks: [{ task_id: 'task-1', execution_mode: 'subagent', status: 'completed', output_path: outputPath, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }],
    }, null, 2),
    'utf8',
  );
  return topicDir;
}

async function evalReviewGates(): Promise<ObjectiveEvalMetric[]> {
  return withTempDir('shift-ax-objective-review-', async (root) => {
    const goodTopic = await createReviewTopic(root, 'good');
    await runReviewLanes({ topicDir: goodTopic });
    const goodAggregate = await aggregateReviewVerdicts({ topicDir: goodTopic });

    const badTopic = await createReviewTopic(root, 'missing-tests');
    const badVerdicts = await runReviewLanes({ topicDir: badTopic });
    const badAggregate = await aggregateReviewVerdicts({ topicDir: badTopic });
    const testAdequacy = badVerdicts.find((verdict) => verdict.lane === 'test-adequacy');

    const correct = Number(goodAggregate.commit_allowed) + Number(!badAggregate.commit_allowed);
    return [
      metric({
        id: 'review.decision_accuracy',
        category: 'review',
        label: 'Review gate allow/block accuracy',
        value: correct / 2,
        unit: 'ratio',
        threshold: 1,
        comparator: 'eq',
        evidence: `good_commit_allowed=${goodAggregate.commit_allowed} blocked=${goodAggregate.blocked_lanes.join(',') || 'none'} changes=${goodAggregate.changes_requested_lanes.join(',') || 'none'} missing=${goodAggregate.missing_lanes.join(',') || 'none'}; missing_tests_commit_allowed=${badAggregate.commit_allowed}.`,
      }),
      metric({
        id: 'review.required_lane_coverage',
        category: 'review',
        label: 'Required review lane coverage',
        value: goodAggregate.required_lanes.length,
        unit: 'count',
        threshold: 10,
        comparator: 'gte',
        evidence: `required_lanes=${goodAggregate.required_lanes.join(',')}.`,
      }),
      metric({
        id: 'review.test_adequacy_blocks_missing_tests',
        category: 'review',
        label: 'Test adequacy blocks implementation without aligned tests',
        value: testAdequacy && testAdequacy.status !== 'approved' ? 1 : 0,
        unit: 'count',
        threshold: 1,
        comparator: 'eq',
        evidence: `test_adequacy_status=${testAdequacy?.status ?? 'missing'}.`,
      }),
    ];
  });
}

async function evalArtifactCompleteness(): Promise<ObjectiveEvalMetric[]> {
  return withTempDir('shift-ax-objective-pipeline-', async (repoRoot) =>
    withTempGlobalHome(async () => {
      await createGitRepo(repoRoot);
      await onboardProjectContext({
        rootDir: repoRoot,
        primaryRoleSummary: 'Maintain auth and payment APIs with TDD.',
        workTypes: [{
          name: 'API development',
          summary: 'Update service boundaries, DTOs, and tests together.',
          repositories: [{
            repository: 'objective-eval-repo',
            repositoryPath: repoRoot,
            purpose: 'Objective eval fixture repository.',
            directories: ['src', 'tests'],
            workflow: 'Update code and tests together, then verify with npm test and npm run build.',
          }],
        }],
        domainLanguage: [{ term: 'Auth policy', definition: 'Fixture auth policy for objective eval.' }],
      });
      const started = await startRequestPipeline({
        rootDir: repoRoot,
        request: 'Build safer auth refresh flow using Auth policy',
        summary: 'Objective eval request',
        baseBranch: 'main',
      });
      const requiredArtifacts = [
        'request.md',
        'request-summary.md',
        'resolved-context.json',
        'brainstorm.md',
        'spec.md',
        'implementation-plan.md',
        'readiness-assessment.json',
        'execution-handoff.json',
        'workflow-state.json',
        'worktree-state.json',
      ];
      const present = requiredArtifacts.filter((artifact) => existsSync(join(started.topicDir, artifact)));
      const workflow = JSON.parse(await readFile(join(started.topicDir, 'workflow-state.json'), 'utf8')) as { phase?: string };
      return [
        metric({
          id: 'artifact.completeness',
          category: 'artifacts',
          label: 'Request-to-plan artifact completeness',
          value: present.length / requiredArtifacts.length,
          unit: 'ratio',
          threshold: 1,
          comparator: 'eq',
          evidence: `${present.length}/${requiredArtifacts.length} required artifacts present in ${started.topicDir}.`,
        }),
        metric({
          id: 'artifact.plan_review_pause',
          category: 'artifacts',
          label: 'Pipeline pauses for human plan review',
          value: workflow.phase === 'awaiting_plan_review' ? 1 : 0,
          unit: 'count',
          threshold: 1,
          comparator: 'eq',
          evidence: `workflow.phase=${workflow.phase ?? 'missing'}.`,
        }),
      ];
    }));
}

export function renderObjectiveEvalMarkdown(report: ObjectiveEvalReport): string {
  const lines = [
    '# Shift AX Objective Eval Report',
    '',
    `- Generated At: ${report.generated_at}`,
    `- Overall Status: ${report.overall_status}`,
    `- Score: ${report.score_percent}%`,
    `- Metrics: ${report.passed_metrics}/${report.metric_count} passed`,
    '',
    '## Scorecard',
    '',
    '| Metric | Value | Threshold | Status | Evidence |',
    '| --- | ---: | ---: | --- | --- |',
  ];
  for (const scenario of report.scenarios) {
    for (const item of scenario.metrics) {
      lines.push(`| ${item.id} | ${item.value} ${item.unit} | ${item.comparator} ${item.threshold} | ${item.status} | ${item.evidence.replace(/\|/g, '/')} |`);
    }
  }
  lines.push('', '## Scenarios', '');
  for (const scenario of report.scenarios) {
    lines.push(`- ${scenario.id}: ${scenario.status} (${scenario.duration_ms}ms)`);
  }
  return `${lines.join('\n')}\n`;
}

export async function writeObjectiveEvalReport(outputDir: string, report: ObjectiveEvalReport): Promise<{
  json_path: string;
  markdown_path: string;
}> {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, 'objective-eval-report.json');
  const markdownPath = join(outputDir, 'objective-eval-report.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, renderObjectiveEvalMarkdown(report), 'utf8'),
  ]);
  return { json_path: jsonPath, markdown_path: markdownPath };
}

export async function runObjectiveEvalSuite({
  outputDir,
  tokenBudgetChars = 1200,
  now = new Date(),
}: RunObjectiveEvalSuiteInput = {}): Promise<ObjectiveEvalReport> {
  const scenarios = [
    await scenario('context-retrieval', 'Context retrieval recall, rank, and precision', evalContextRetrieval),
    await scenario('planning-readiness', 'Ambiguity scoring and implementation readiness', evalPlanningReadiness),
    await scenario('token-efficiency', 'Context bundle token budget and reduction', () => evalTokenEfficiency(tokenBudgetChars)),
    await scenario('deterministic-harness', 'FSM, DAG queue, retry, and idempotency rails', evalHarnessDeterminism),
    await scenario('review-gates', 'Review gate allow/block behavior', evalReviewGates),
    await scenario('artifact-completeness', 'Request-to-plan artifact completeness', evalArtifactCompleteness),
  ];
  const metrics = scenarios.flatMap((item) => item.metrics);
  const passed = metrics.filter((item) => item.status === 'passed').length;
  const failed = metrics.length - passed;
  const report: ObjectiveEvalReport = {
    version: 1,
    suite: 'shift-ax-objective-eval',
    generated_at: now.toISOString(),
    overall_status: failed === 0 ? 'passed' : 'failed',
    score_percent: Math.round((passed / Math.max(metrics.length, 1)) * 100),
    metric_count: metrics.length,
    passed_metrics: passed,
    failed_metrics: failed,
    scenarios,
  };
  if (outputDir) await writeObjectiveEvalReport(outputDir, report);
  return report;
}
