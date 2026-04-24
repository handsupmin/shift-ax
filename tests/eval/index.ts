/**
 * shift-ax Eval Suite — Golden Path + Core Feature Scenarios
 *
 * Measures functional correctness across the five primary features:
 *   1. Context Resolver  — recall, precision, MRR
 *   2. Glossary Extraction — term precision
 *   3. Topic Recall — recall@3, ranking accuracy
 *   4. Request Pipeline — golden path pass rate
 *   5. Consistency — determinism across identical inputs
 *
 * Exits with code 1 if any metric falls below its baseline.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

import { parseIndexDocument, resolveContextFromIndex } from '../../core/context/index-resolver.js';
import { extractDomainGlossaryEntries } from '../../core/context/glossary.js';
import { searchPastTopics } from '../../core/memory/topic-recall.js';
import { startRequestPipeline, readWorkflowState } from '../../core/planning/request-pipeline.js';
import { seedSampleOnboarding } from '../helpers/sample-onboarding.js';
import { withTempGlobalHome } from '../helpers/global-home.js';

// ─── helpers ────────────────────────────────────────────────────────────────

interface ScenarioResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: ScenarioResult[] = [];

function pass(name: string, detail?: string): void {
  results.push({ name, passed: true, detail });
  console.log(`  ✓  ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name: string, detail?: string): void {
  results.push({ name, passed: false, detail });
  console.log(`  ✗  ${name}${detail ? ` — ${detail})` : ''}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'shift-ax-eval-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function createGitRepo(root: string): Promise<void> {
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Eval Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'eval@shift-ax.test'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# eval-repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
}

// ─── FEATURE 1: Context Resolver ────────────────────────────────────────────

/**
 * Labeled test dataset: (query, expectedLabel) pairs.
 * Each entry represents a query that should resolve to the named index label.
 */
const CONTEXT_RESOLVER_LABELED_DATASET = [
  { query: 'auth refresh token rotation policy', expectedLabel: 'Auth policy' },
  { query: 'payment gateway integration retry logic', expectedLabel: 'Payment gateway' },
  { query: 'user onboarding flow first-time setup', expectedLabel: 'Onboarding flow' },
  { query: 'API rate limiting configuration threshold', expectedLabel: 'API rate limits' },
  { query: 'database migration rollback strategy', expectedLabel: 'Database migrations' },
  { query: 'deployment pipeline CI CD workflow', expectedLabel: 'Deployment pipeline' },
  { query: 'error handling exception boundaries service', expectedLabel: 'Error handling' },
  { query: 'audit logging compliance requirements', expectedLabel: 'Audit logging' },
  { query: 'feature flags configuration toggles', expectedLabel: 'Feature flags' },
  { query: 'team code review process standards', expectedLabel: 'Code review' },
] as const;

/**
 * Irrelevant queries that should match nothing (precision test).
 */
const IRRELEVANT_QUERIES = [
  'zzzz nonsense banana xylophone',
  'QWERTY DVORAK COLEMAK',
  '123456789',
  'aaaa',
  '   ',
];

async function buildContextResolverIndex(dir: string): Promise<string> {
  const indexLines = [
    '# Shift AX Global Index',
    '',
    '## Work Types',
    '',
    '- Auth policy -> work-types/auth-policy.md',
    '- Payment gateway -> work-types/payment-gateway.md',
    '- Onboarding flow -> work-types/onboarding-flow.md',
    '- API rate limits -> work-types/api-rate-limits.md',
    '- Database migrations -> work-types/database-migrations.md',
    '- Deployment pipeline -> work-types/deployment-pipeline.md',
    '- Error handling -> work-types/error-handling.md',
    '- Audit logging -> work-types/audit-logging.md',
    '- Feature flags -> work-types/feature-flags.md',
    '- Code review -> work-types/code-review.md',
    '',
  ];

  const indexPath = join(dir, 'index.md');
  await writeFile(indexPath, indexLines.join('\n'), 'utf8');

  await mkdir(join(dir, 'work-types'), { recursive: true });
  const docs: Record<string, string> = {
    'auth-policy.md': '# Auth Policy\n\nToken rotation and refresh rules for authentication.\n',
    'payment-gateway.md': '# Payment Gateway\n\nPayment integration, retry logic, and webhook handling.\n',
    'onboarding-flow.md': '# Onboarding Flow\n\nFirst-time user setup, guided walkthrough, and state initialization.\n',
    'api-rate-limits.md': '# API Rate Limits\n\nThreshold configuration for API rate limiting and throttling.\n',
    'database-migrations.md': '# Database Migrations\n\nRollback strategy and migration versioning for database schema changes.\n',
    'deployment-pipeline.md': '# Deployment Pipeline\n\nCI/CD workflow, build steps, staging, and production deployment.\n',
    'error-handling.md': '# Error Handling\n\nException boundaries, error recovery, and service-level error contracts.\n',
    'audit-logging.md': '# Audit Logging\n\nCompliance requirements for audit trail and event logging.\n',
    'feature-flags.md': '# Feature Flags\n\nConfiguration toggles for gradual rollout and feature gating.\n',
    'code-review.md': '# Code Review\n\nTeam standards for pull request reviews and merge approvals.\n',
  };

  for (const [filename, content] of Object.entries(docs)) {
    await writeFile(join(dir, 'work-types', filename), content, 'utf8');
  }

  return indexPath;
}

async function evalContextResolverRecall(): Promise<void> {
  section('Feature 1: Context Resolver — Recall');

  await withTmpDir(async (dir) => {
    const indexPath = await buildContextResolverIndex(dir);
    let hits = 0;
    let reciprocalRankSum = 0;

    for (const { query, expectedLabel } of CONTEXT_RESOLVER_LABELED_DATASET) {
      const result = await resolveContextFromIndex({
        rootDir: dir,
        indexPath,
        query,
        maxMatches: 5,
      });

      const matchIndex = result.matches.findIndex((m) => m.label === expectedLabel);
      const found = matchIndex >= 0;

      if (found) {
        hits++;
        reciprocalRankSum += 1 / (matchIndex + 1);
        pass(`recall: "${expectedLabel}" found at rank ${matchIndex + 1}`);
      } else {
        fail(`recall: "${expectedLabel}" not found for query "${query}"`);
      }
    }

    const N = CONTEXT_RESOLVER_LABELED_DATASET.length;
    const recallPct = Math.round((hits / N) * 100);
    const mrr = reciprocalRankSum / N;

    console.log(`\n  Recall@5: ${hits}/${N} = ${recallPct}%  (baseline ≥ 90%)`);
    console.log(`  MRR:      ${mrr.toFixed(3)}           (baseline ≥ 0.80)\n`);

    if (recallPct < 90) fail(`METRIC recall@5 = ${recallPct}% < 90% baseline`);
    else pass(`METRIC recall@5 = ${recallPct}%`);

    if (mrr < 0.80) fail(`METRIC MRR = ${mrr.toFixed(3)} < 0.80 baseline`);
    else pass(`METRIC MRR = ${mrr.toFixed(3)}`);
  });
}

async function evalContextResolverPrecision(): Promise<void> {
  section('Feature 1: Context Resolver — Precision (adversarial queries)');

  await withTmpDir(async (dir) => {
    const indexPath = await buildContextResolverIndex(dir);
    let falsePositives = 0;

    for (const query of IRRELEVANT_QUERIES) {
      const trimmed = query.trim();
      if (!trimmed) {
        // Empty/whitespace: expect a thrown error, not a false match
        try {
          await resolveContextFromIndex({ rootDir: dir, indexPath, query, maxMatches: 5 });
          fail(`precision: empty/whitespace query should throw but did not`);
        } catch {
          pass(`precision: empty query "${JSON.stringify(query)}" threw as expected`);
        }
        continue;
      }

      const result = await resolveContextFromIndex({
        rootDir: dir,
        indexPath,
        query: trimmed,
        maxMatches: 5,
      });

      if (result.matches.length === 0) {
        pass(`precision: no matches for irrelevant "${trimmed}"`);
      } else {
        falsePositives++;
        fail(`precision: unexpected ${result.matches.length} matches for irrelevant "${trimmed}"`);
      }
    }

    const relevantCount = IRRELEVANT_QUERIES.filter((q) => q.trim()).length;
    const fpRate = Math.round((falsePositives / relevantCount) * 100);
    console.log(`\n  False Positive Rate: ${falsePositives}/${relevantCount} = ${fpRate}%  (baseline ≤ 10%)\n`);

    if (fpRate > 10) fail(`METRIC false positive rate = ${fpRate}% > 10% baseline`);
    else pass(`METRIC false positive rate = ${fpRate}%`);
  });
}

// ─── FEATURE 2: Glossary Extraction ─────────────────────────────────────────

const GLOSSARY_LABELED_DATASET = [
  {
    name: 'CamelCase terms extracted',
    content: '# Auth Module\n\nThe AuthRefreshToken and TokenRotationPolicy control session lifecycle.\n',
    expected: ['AuthRefreshToken', 'TokenRotationPolicy'],
  },
  {
    name: 'Title Case phrases extracted',
    content: '# API Design\n\nIn this system: Rate Limiting Policy and Error Boundary Contract govern service behavior.\n',
    expected: ['Rate Limiting Policy', 'Error Boundary Contract'],
  },
  {
    name: 'Heading terms captured',
    content: '# PaymentGatewayService\n\nHandles payment webhooks.\n',
    expected: ['PaymentGatewayService'],
  },
  {
    name: 'Short terms (< 4 chars) excluded',
    content: '# Design\n\nUse the API and set the env var for DB.\n',
    excluded: ['API', 'DB', 'env'],
  },
  {
    name: 'Multi-source deduplication',
    content: '# Module A\n\nUse AuthToken here.\n\n# Module B\n\nAuthToken is reused here.\n',
    expectedDeduped: ['AuthToken'],
  },
] as const;

async function evalGlossaryExtraction(): Promise<void> {
  section('Feature 2: Glossary Extraction — Term Precision');

  await withTmpDir(async (dir) => {
    let correct = 0;
    let total = 0;

    for (const tc of GLOSSARY_LABELED_DATASET) {
      const docPath = 'doc.md';
      await writeFile(join(dir, docPath), tc.content, 'utf8');

      const entries = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: [docPath] });
      const extractedTerms = entries.map((e) => e.term);

      if ('expected' in tc) {
        for (const term of tc.expected) {
          total++;
          if (extractedTerms.includes(term)) {
            correct++;
            pass(`glossary: "${term}" extracted for "${tc.name}"`);
          } else {
            fail(`glossary: "${term}" NOT extracted for "${tc.name}" (got: ${extractedTerms.slice(0, 5).join(', ')})`);
          }
        }
      }

      if ('excluded' in tc) {
        for (const term of tc.excluded) {
          total++;
          if (!extractedTerms.includes(term)) {
            correct++;
            pass(`glossary: "${term}" correctly excluded for "${tc.name}"`);
          } else {
            fail(`glossary: "${term}" incorrectly included for "${tc.name}"`);
          }
        }
      }

      if ('expectedDeduped' in tc) {
        const docPath2 = 'doc2.md';
        await writeFile(join(dir, docPath2), tc.content, 'utf8');
        const multi = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: [docPath, docPath2] });
        const multiTerms = multi.map((e) => e.term);
        for (const term of tc.expectedDeduped) {
          total++;
          const count = multiTerms.filter((t) => t === term).length;
          if (count === 1) {
            correct++;
            pass(`glossary: "${term}" deduplicated correctly`);
          } else {
            fail(`glossary: "${term}" appeared ${count} times (expected 1)`);
          }
        }
      }
    }

    const pct = Math.round((correct / total) * 100);
    console.log(`\n  Glossary Precision: ${correct}/${total} = ${pct}%  (baseline ≥ 85%)\n`);

    if (pct < 85) fail(`METRIC glossary precision = ${pct}% < 85% baseline`);
    else pass(`METRIC glossary precision = ${pct}%`);
  });
}

// ─── FEATURE 3: Topic Recall ─────────────────────────────────────────────────

async function seedCommittedTopic(root: string, slug: string, summary: string, updatedAt: string): Promise<void> {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(topicDir, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'spec.md'), `# Topic Spec\n\n${summary}\n`, 'utf8');
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify({ version: 1, topic_slug: slug, phase: 'committed', created_at: updatedAt, updated_at: updatedAt, plan_review_status: 'approved' }, null, 2),
    'utf8',
  );
}

const TOPIC_RECALL_DATASET = [
  {
    name: 'direct match: exact domain terms',
    seed: [
      { slug: '2026-01-01-auth-refresh', summary: 'Auth refresh token rotation', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: '2026-01-02-payment-retry', summary: 'Payment retry backoff strategy', updatedAt: '2026-01-02T00:00:00.000Z' },
      { slug: '2026-01-03-deploy-pipeline', summary: 'Deployment pipeline CI CD setup', updatedAt: '2026-01-03T00:00:00.000Z' },
    ],
    query: 'auth refresh token rotation',
    expectedSlug: '2026-01-01-auth-refresh',
  },
  {
    name: 'ranking: higher score beats older date',
    seed: [
      { slug: '2026-02-01-old-auth', summary: 'Auth refresh rotation policy token', updatedAt: '2026-02-01T00:00:00.000Z' },
      { slug: '2026-02-10-new-payment', summary: 'Payment integration webhook', updatedAt: '2026-02-10T00:00:00.000Z' },
    ],
    query: 'auth refresh rotation policy token',
    expectedSlug: '2026-02-01-old-auth',
  },
  {
    name: 'tie-break: same score, newer wins',
    seed: [
      { slug: '2026-03-01-older', summary: 'Deploy pipeline CI CD workflow setup', updatedAt: '2026-03-01T00:00:00.000Z' },
      { slug: '2026-03-10-newer', summary: 'Deploy pipeline CI CD workflow setup', updatedAt: '2026-03-10T00:00:00.000Z' },
    ],
    query: 'deploy pipeline CI CD workflow setup',
    expectedSlug: '2026-03-10-newer',
  },
  {
    name: 'no match: unrelated query returns empty',
    seed: [
      { slug: '2026-04-01-auth', summary: 'Auth token refresh rotation', updatedAt: '2026-04-01T00:00:00.000Z' },
    ],
    query: 'banana xylophone zzzz',
    expectedSlug: null,
  },
] as const;

async function evalTopicRecall(): Promise<void> {
  section('Feature 3: Topic Recall — Recall@3 + Ranking Accuracy');

  await withTmpDir(async (root) => {
    let correct = 0;
    const total = TOPIC_RECALL_DATASET.length;

    for (const tc of TOPIC_RECALL_DATASET) {
      for (const { slug, summary, updatedAt } of tc.seed) {
        await seedCommittedTopic(root, slug, summary, updatedAt);
      }

      const matches = await searchPastTopics({ rootDir: root, query: tc.query, limit: 3 });
      const topSlug = matches[0]?.topic_slug ?? null;

      if (topSlug === tc.expectedSlug) {
        correct++;
        pass(`recall: "${tc.name}" → got "${topSlug}"`);
      } else {
        fail(`recall: "${tc.name}" → expected "${tc.expectedSlug}", got "${topSlug}"`);
      }
    }

    const pct = Math.round((correct / total) * 100);
    console.log(`\n  Topic Recall Accuracy: ${correct}/${total} = ${pct}%  (baseline ≥ 90%)\n`);

    if (pct < 90) fail(`METRIC topic recall accuracy = ${pct}% < 90% baseline`);
    else pass(`METRIC topic recall accuracy = ${pct}%`);
  });
}

// ─── FEATURE 4: Request Pipeline — Golden Path ───────────────────────────────

async function evalRequestPipelineGoldenPath(): Promise<void> {
  section('Feature 4: Request Pipeline — Golden Path');

  const repoRoot = await mkdtemp(join(tmpdir(), 'shift-ax-eval-pipeline-'));

  try {
    await withTempGlobalHome('shift-ax-eval-home-', async () => {
      await createGitRepo(repoRoot);
      await seedSampleOnboarding(repoRoot);

      const started = await startRequestPipeline({
        rootDir: repoRoot,
        request: 'Build safer auth refresh flow',
        summary: 'Auth refresh delivery with plan gate',
        baseBranch: 'main',
      });

      const workflow = await readWorkflowState(started.topicDir);

      if (workflow.phase === 'awaiting_plan_review') {
        pass('pipeline: phase is awaiting_plan_review after start');
      } else {
        fail(`pipeline: expected awaiting_plan_review, got ${workflow.phase}`);
      }

      if (started.worktree.worktree_path) {
        pass('pipeline: worktree created');
      } else {
        fail('pipeline: worktree_path missing');
      }

      if (started.resolvedContext.matches.length > 0) {
        pass(`pipeline: resolved ${started.resolvedContext.matches.length} context matches`);
      } else {
        fail('pipeline: no context matches resolved');
      }

      if (started.topicDir.includes('.ax/topics/')) {
        pass(`pipeline: topic directory created at ${started.topicDir}`);
      } else {
        fail(`pipeline: unexpected topicDir path ${started.topicDir}`);
      }
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

// ─── FEATURE 5: Consistency ──────────────────────────────────────────────────

async function evalConsistency(): Promise<void> {
  section('Feature 5: Consistency — Determinism');

  await withTmpDir(async (dir) => {
    const indexPath = await buildContextResolverIndex(dir);

    const queries = [
      'auth refresh token rotation policy',
      'payment gateway integration retry',
      'database migration rollback strategy',
    ] as const;

    let consistent = 0;

    for (const query of queries) {
      const r1 = await resolveContextFromIndex({ rootDir: dir, indexPath, query, maxMatches: 5 });
      const r2 = await resolveContextFromIndex({ rootDir: dir, indexPath, query, maxMatches: 5 });

      const labels1 = r1.matches.map((m) => m.label).join(',');
      const labels2 = r2.matches.map((m) => m.label).join(',');

      if (labels1 === labels2) {
        consistent++;
        pass(`consistency: "${query}" → same result both runs`);
      } else {
        fail(`consistency: "${query}" → run1="${labels1}", run2="${labels2}"`);
      }
    }

    const pct = Math.round((consistent / queries.length) * 100);
    console.log(`\n  Consistency: ${consistent}/${queries.length} = ${pct}%  (baseline = 100%)\n`);

    if (pct < 100) fail(`METRIC consistency = ${pct}% < 100% baseline`);
    else pass(`METRIC consistency = ${pct}%`);
  });
}

// ─── parseIndexDocument unit eval ────────────────────────────────────────────

async function evalParseIndexDocument(): Promise<void> {
  section('Feature 1 (unit): parseIndexDocument — Format Fidelity');

  const fixtures: Array<{ name: string; input: string; expectedCount: number; expectedFirst?: { label: string; path: string } }> = [
    {
      name: 'standard markdown list',
      input: '- Auth policy -> work-types/auth-policy.md\n- Payment -> work-types/payment.md\n',
      expectedCount: 2,
      expectedFirst: { label: 'Auth policy', path: 'work-types/auth-policy.md' },
    },
    {
      name: 'mixed whitespace around arrow',
      input: '- Auth policy  ->  work-types/auth.md\n',
      expectedCount: 1,
      expectedFirst: { label: 'Auth policy', path: 'work-types/auth.md' },
    },
    {
      name: 'lines without arrow skipped',
      input: '# Heading\n\n- No arrow line\n- Has arrow -> path/doc.md\n',
      expectedCount: 1,
    },
    {
      name: 'empty string returns zero entries',
      input: '',
      expectedCount: 0,
    },
    {
      name: 'non-list lines ignored',
      input: 'Some prose\n\nAnother paragraph\n\n- Term -> path/term.md\n',
      expectedCount: 1,
    },
  ];

  let correct = 0;
  const total = fixtures.length;

  for (const tc of fixtures) {
    const entries = parseIndexDocument(tc.input);

    if (entries.length !== tc.expectedCount) {
      fail(`parseIndex "${tc.name}": expected ${tc.expectedCount} entries, got ${entries.length}`);
      continue;
    }

    if (tc.expectedFirst) {
      const first = entries[0];
      if (first?.label === tc.expectedFirst.label && first?.path === tc.expectedFirst.path) {
        correct++;
        pass(`parseIndex "${tc.name}": label and path match`);
      } else {
        fail(`parseIndex "${tc.name}": expected label="${tc.expectedFirst.label}" path="${tc.expectedFirst.path}", got label="${first?.label}" path="${first?.path}"`);
      }
    } else {
      correct++;
      pass(`parseIndex "${tc.name}": entry count matches`);
    }
  }

  const pct = Math.round((correct / total) * 100);
  console.log(`\n  parseIndexDocument: ${correct}/${total} = ${pct}%  (baseline ≥ 90%)\n`);

  if (pct < 90) fail(`METRIC parseIndexDocument = ${pct}% < 90% baseline`);
  else pass(`METRIC parseIndexDocument = ${pct}%`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          shift-ax Eval Suite — Golden Path & Core           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await evalParseIndexDocument();
  await evalContextResolverRecall();
  await evalContextResolverPrecision();
  await evalGlossaryExtraction();
  await evalTopicRecall();
  await evalRequestPipelineGoldenPath();
  await evalConsistency();

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SCORECARD                            ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Passed: ${String(passed).padEnd(4)}  Failed: ${String(failed).padEnd(4)}  Total: ${String(total).padEnd(4)}  Score: ${String(pct + '%').padEnd(5)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('FAILED scenarios:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ✗  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Eval suite crashed:', err);
  process.exit(1);
});
