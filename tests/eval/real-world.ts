/**
 * shift-ax Eval Suite — Real-World Fixtures
 *
 * Tests against realistic production-like scenarios drawn from common
 * software engineering team workflows:
 *
 *   - Multi-project engineering team domain vocabulary
 *   - Realistic request queries a developer would actually type
 *   - Mixed-language domain terms (Korean/English common in global teams)
 *   - Realistic onboarding fixture with domain language, work types, procedures
 *   - Past-topic recall from a realistic committed topic history
 *
 * Exits with code 1 if recall or precision falls below baselines.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

import { resolveContextFromIndex } from '../../core/context/index-resolver.js';
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
  console.log(`  ✗  ${name}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'shift-ax-rw-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function createGitRepo(root: string): Promise<void> {
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'RW Eval'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'rw-eval@shift-ax.test'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# rw-eval-repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
}

// ─── Realistic global context index ──────────────────────────────────────────
//
// Represents a mid-size engineering team working across:
//   auth-service, payment-service, platform-core, data-pipeline, frontend

async function buildRealisticIndex(dir: string): Promise<string> {
  const indexLines = [
    '# Shift AX Global Index',
    '',
    '## Work Types',
    '',
    '- Auth token rotation policy -> work-types/auth-token-rotation.md',
    '- Payment webhook handling -> work-types/payment-webhook.md',
    '- Service deployment runbook -> work-types/deployment-runbook.md',
    '- Database migration guide -> work-types/db-migration.md',
    '- Feature flag rollout process -> work-types/feature-flags.md',
    '- On-call escalation procedure -> work-types/oncall-escalation.md',
    '- Code review standards -> work-types/code-review.md',
    '- Frontend performance budget -> work-types/frontend-perf.md',
    '- API versioning contract -> work-types/api-versioning.md',
    '- Data pipeline SLA -> work-types/data-sla.md',
    '',
    '## Domain Language',
    '',
    '- RefreshToken lifecycle -> domain/refresh-token.md',
    '- CustomerOrder state machine -> domain/order-state.md',
    '- ServiceMesh routing -> domain/service-mesh.md',
    '',
  ];

  const indexPath = join(dir, 'index.md');
  await writeFile(indexPath, indexLines.join('\n'), 'utf8');
  await mkdir(join(dir, 'work-types'), { recursive: true });
  await mkdir(join(dir, 'domain'), { recursive: true });

  const docs: Record<string, string> = {
    'work-types/auth-token-rotation.md': '# Auth Token Rotation Policy\n\nRotate refresh tokens on use. Expire access tokens at 15 min. Enforce single-session policy per user.\n',
    'work-types/payment-webhook.md': '# Payment Webhook Handling\n\nVerify Stripe signatures. Idempotency key per event. Dead-letter queue for failures.\n',
    'work-types/deployment-runbook.md': '# Service Deployment Runbook\n\nBlue-green deployment. Rollback procedure: revert to previous tag. Health check required before traffic shift.\n',
    'work-types/db-migration.md': '# Database Migration Guide\n\nBackward-compatible schema changes only. Run migrations before code deploy. Rollback script required.\n',
    'work-types/feature-flags.md': '# Feature Flag Rollout Process\n\nLaunchDarkly for flags. Default off. Canary at 1%, 10%, 50%, 100%. Flag cleanup after 30 days.\n',
    'work-types/oncall-escalation.md': '# On-Call Escalation Procedure\n\nPage primary on-call. If no ACK in 5 min, escalate to secondary. Severity 1 requires incident bridge.\n',
    'work-types/code-review.md': '# Code Review Standards\n\nTwo approvals for main. One for feature branches. Security-sensitive paths require security team review.\n',
    'work-types/frontend-perf.md': '# Frontend Performance Budget\n\nBundle size max 200kB gzipped. LCP < 2.5s. CLS < 0.1. Core Web Vitals tracked weekly.\n',
    'work-types/api-versioning.md': '# API Versioning Contract\n\nURL versioning: /v1/, /v2/. Deprecation notice 3 months ahead. Breaking changes only in major versions.\n',
    'work-types/data-sla.md': '# Data Pipeline SLA\n\nIngest latency < 5 min p95. Backfill within 24h. Downstream consumer notification on schema change.\n',
    'domain/refresh-token.md': '# RefreshToken Lifecycle\n\nIssued on login. Rotated on refresh. Invalidated on logout or suspected compromise.\n',
    'domain/order-state.md': '# CustomerOrder State Machine\n\npending → confirmed → fulfilling → shipped → delivered. Cancel allowed until fulfilling.\n',
    'domain/service-mesh.md': '# ServiceMesh Routing\n\nIstio-based routing. Traffic mirroring for canary. mTLS between all services.\n',
  };

  for (const [path, content] of Object.entries(docs)) {
    await writeFile(join(dir, path), content, 'utf8');
  }

  return indexPath;
}

// ─── RW 1: Realistic developer queries ───────────────────────────────────────

const REALISTIC_QUERIES = [
  {
    query: 'my refresh token keeps getting invalidated, need to check the rotation policy',
    expectedLabel: 'Auth token rotation policy',
    desc: 'auth debug query',
  },
  {
    query: 'stripe webhook 400 error idempotency issue',
    expectedLabel: 'Payment webhook handling',
    desc: 'payment integration query',
  },
  {
    query: 'how do I rollback the deployment after a failed release',
    expectedLabel: 'Service deployment runbook',
    desc: 'ops runbook query',
  },
  {
    query: 'can I add a column to users table without downtime',
    expectedLabel: 'Database migration guide',
    desc: 'db schema change query',
  },
  {
    query: 'gradually rolling out new checkout feature to 10% of users',
    expectedLabel: 'Feature flag rollout process',
    desc: 'feature rollout query',
  },
  {
    query: 'alert fired at 3am, nobody responded, what is the escalation path',
    expectedLabel: 'On-call escalation procedure',
    desc: 'incident response query',
  },
  {
    query: 'PR needs security review because it touches JWT signing code',
    expectedLabel: 'Code review standards',
    desc: 'code review query',
  },
  {
    query: 'our bundle size jumped to 400kb after the new library install',
    expectedLabel: 'Frontend performance budget',
    desc: 'frontend perf query',
  },
  {
    query: 'clients are still calling v1 endpoint, when can we remove it',
    expectedLabel: 'API versioning contract',
    desc: 'api deprecation query',
  },
  {
    query: 'data pipeline is 10 minutes behind on ingest today',
    expectedLabel: 'Data pipeline SLA',
    desc: 'data latency query',
  },
] as const;

async function evalRealisticRecall(): Promise<void> {
  section('RW 1: Realistic Developer Queries — Recall');

  await withTmpDir(async (dir) => {
    const indexPath = await buildRealisticIndex(dir);
    let hits = 0;
    let reciprocalRankSum = 0;

    for (const { query, expectedLabel, desc } of REALISTIC_QUERIES) {
      const result = await resolveContextFromIndex({ rootDir: dir, indexPath, query, maxMatches: 5 });
      const idx = result.matches.findIndex((m) => m.label === expectedLabel);

      if (idx >= 0) {
        hits++;
        reciprocalRankSum += 1 / (idx + 1);
        console.log(`  ✓  rw recall (${desc}): "${expectedLabel}" at rank ${idx + 1}`);
      } else {
        // Diagnostic — reported but not counted as individual scenario failure.
        // Lexical matching misses semantically equivalent but vocabulary-different queries.
        console.log(`  ~  rw recall (${desc}): "${expectedLabel}" not found — lexical gap (top=${result.matches[0]?.label ?? 'none'})`);
      }
    }

    const N = REALISTIC_QUERIES.length;
    const recallPct = Math.round((hits / N) * 100);
    const mrr = reciprocalRankSum / N;

    console.log(`\n  Realistic Recall@5: ${hits}/${N} = ${recallPct}%  (baseline ≥ 60%)`);
    console.log(`  Realistic MRR:      ${mrr.toFixed(3)}           (baseline ≥ 0.60)\n`);

    // 60% baseline reflects the known limitation of lexical token matching:
    // queries using different vocabulary than index labels (e.g. "bundle size"
    // instead of "performance budget") will miss without semantic understanding.
    if (recallPct < 60) fail(`METRIC realistic recall@5 = ${recallPct}% < 60% baseline`);
    else pass(`METRIC realistic recall@5 = ${recallPct}%`);

    if (mrr < 0.60) fail(`METRIC realistic MRR = ${mrr.toFixed(3)} < 0.60 baseline`);
    else pass(`METRIC realistic MRR = ${mrr.toFixed(3)}`);
  });
}

// ─── RW 2: Realistic glossary corpus ─────────────────────────────────────────

async function evalRealisticGlossaryCorpus(): Promise<void> {
  section('RW 2: Realistic Codebase Docs — Glossary Extraction');

  await withTmpDir(async (dir) => {
    const docPaths = ['arch.md', 'api.md', 'domain.md'];

    await writeFile(join(dir, 'arch.md'), [
      '# Architecture Overview',
      '',
      'The system uses a ServiceMesh backed by Istio for inter-service communication.',
      'The AuthService handles token issuance. The PaymentOrchestrator coordinates',
      'charge attempts across multiple PaymentGateway implementations.',
      '',
      'Each bounded context exposes a PublicApiContract versioned under /v1/ or /v2/.',
      '',
    ].join('\n'), 'utf8');

    await writeFile(join(dir, 'api.md'), [
      '# API Design',
      '',
      'All endpoints follow the ResourceIdentifier naming convention.',
      'The RequestContextHeader is required on every mutating call.',
      'The IdempotencyKey prevents double charges in the PaymentGateway.',
      '',
    ].join('\n'), 'utf8');

    await writeFile(join(dir, 'domain.md'), [
      '# Domain Model',
      '',
      'A CustomerOrder progresses through states: pending, confirmed, fulfilling, delivered.',
      'The RefreshToken is rotated on each use per the AuthService policy.',
      'The InvoiceLedger tracks all financial transactions immutably.',
      '',
    ].join('\n'), 'utf8');

    const entries = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: docPaths });
    const terms = entries.map((e) => e.term);

    const mustFind = ['ServiceMesh', 'AuthService', 'PaymentOrchestrator', 'PublicApiContract', 'RefreshToken', 'CustomerOrder', 'InvoiceLedger'];
    let found = 0;

    for (const term of mustFind) {
      if (terms.includes(term)) {
        found++;
        pass(`glossary rw: "${term}" extracted`);
      } else {
        fail(`glossary rw: "${term}" NOT extracted (got: ${terms.slice(0, 8).join(', ')})`);
      }
    }

    const pct = Math.round((found / mustFind.length) * 100);
    console.log(`\n  Realistic Glossary Precision: ${found}/${mustFind.length} = ${pct}%  (baseline ≥ 75%)\n`);

    if (pct < 75) fail(`METRIC realistic glossary precision = ${pct}% < 75% baseline`);
    else pass(`METRIC realistic glossary precision = ${pct}%`);
  });
}

// ─── RW 3: Realistic past-topic history ──────────────────────────────────────

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

async function evalRealisticTopicHistory(): Promise<void> {
  section('RW 3: Realistic Past-Topic History — Recall');

  await withTmpDir(async (root) => {
    const history = [
      { slug: '2026-01-05-auth-rotation', summary: 'Implement auth refresh token rotation with single-session enforcement', updatedAt: '2026-01-05T10:00:00.000Z' },
      { slug: '2026-01-12-payment-webhook', summary: 'Fix payment webhook idempotency and dead-letter queue integration', updatedAt: '2026-01-12T14:00:00.000Z' },
      { slug: '2026-01-20-db-migration', summary: 'Add nullable column to orders table with rollback script', updatedAt: '2026-01-20T09:00:00.000Z' },
      { slug: '2026-02-03-feature-flag', summary: 'LaunchDarkly feature flag for new checkout flow gradual rollout', updatedAt: '2026-02-03T11:00:00.000Z' },
      { slug: '2026-02-14-api-versioning', summary: 'Deprecate v1 user endpoint and migrate callers to v2', updatedAt: '2026-02-14T16:00:00.000Z' },
      { slug: '2026-02-22-oncall-runbook', summary: 'Update on-call escalation runbook with new pager duty integration', updatedAt: '2026-02-22T08:00:00.000Z' },
      { slug: '2026-03-01-frontend-bundle', summary: 'Reduce frontend bundle size to meet 200kB performance budget', updatedAt: '2026-03-01T13:00:00.000Z' },
      { slug: '2026-03-15-data-pipeline', summary: 'Fix data pipeline ingest delay and SLA alerting threshold', updatedAt: '2026-03-15T10:00:00.000Z' },
    ];

    for (const { slug, summary, updatedAt } of history) {
      await seedCommittedTopic(root, slug, summary, updatedAt);
    }

    const queries: Array<{ query: string; expectedSlug: string; desc: string }> = [
      { query: 'refresh token rotation single session', expectedSlug: '2026-01-05-auth-rotation', desc: 'auth rotation' },
      { query: 'payment webhook idempotency dead letter queue', expectedSlug: '2026-01-12-payment-webhook', desc: 'webhook idempotency' },
      { query: 'database orders table rollback migration', expectedSlug: '2026-01-20-db-migration', desc: 'db migration' },
      { query: 'LaunchDarkly feature flag checkout rollout', expectedSlug: '2026-02-03-feature-flag', desc: 'feature flag' },
      { query: 'v1 endpoint deprecation migrate callers v2', expectedSlug: '2026-02-14-api-versioning', desc: 'api versioning' },
      { query: 'data pipeline ingest delay SLA alerting', expectedSlug: '2026-03-15-data-pipeline', desc: 'data pipeline' },
    ];

    let hits = 0;

    for (const { query, expectedSlug, desc } of queries) {
      const matches = await searchPastTopics({ rootDir: root, query, limit: 3 });
      const topSlug = matches[0]?.topic_slug;

      if (topSlug === expectedSlug) {
        hits++;
        pass(`topic history (${desc}): correct topic returned`);
      } else {
        fail(`topic history (${desc}): expected "${expectedSlug}", got "${topSlug}"`);
      }
    }

    const pct = Math.round((hits / queries.length) * 100);
    console.log(`\n  Realistic Topic Recall: ${hits}/${queries.length} = ${pct}%  (baseline ≥ 80%)\n`);

    if (pct < 80) fail(`METRIC realistic topic recall = ${pct}% < 80% baseline`);
    else pass(`METRIC realistic topic recall = ${pct}%`);
  });
}

// ─── RW 4: Realistic request pipeline with production-like context ────────────

async function evalRealisticRequestPipeline(): Promise<void> {
  section('RW 4: Request Pipeline — Realistic Engineering Request');

  const repoRoot = await mkdtemp(join(tmpdir(), 'shift-ax-rw-pipeline-'));

  try {
    await withTempGlobalHome('shift-ax-rw-home-', async () => {
      await createGitRepo(repoRoot);
      await seedSampleOnboarding(repoRoot);

      const requests = [
        {
          request: 'Fix the auth refresh token rotation to enforce single-session per user',
          summary: 'Security improvement for auth token management',
        },
        {
          request: 'Add idempotency key handling to the payment webhook processor',
          summary: 'Payment reliability improvement',
        },
      ];

      let passed_count = 0;

      for (const { request, summary } of requests) {
        const started = await startRequestPipeline({
          rootDir: repoRoot,
          request,
          summary,
          baseBranch: 'main',
          now: new Date(),
        });

        const workflow = await readWorkflowState(started.topicDir);

        if (workflow.phase === 'awaiting_plan_review' && started.topicDir.includes('.ax/topics/')) {
          passed_count++;
          pass(`rw pipeline: "${summary}" → topic created and awaiting plan review`);
        } else {
          fail(`rw pipeline: "${summary}" → unexpected phase "${workflow.phase}"`);
        }
      }

      const pct = Math.round((passed_count / requests.length) * 100);
      console.log(`\n  Realistic Pipeline Pass Rate: ${passed_count}/${requests.length} = ${pct}%  (baseline = 100%)\n`);

      if (pct < 100) fail(`METRIC realistic pipeline pass rate = ${pct}% < 100% baseline`);
      else pass(`METRIC realistic pipeline pass rate = ${pct}%`);
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

// ─── RW 5: Mixed-language queries (Korean/English) ────────────────────────────

async function evalMultilingualQueries(): Promise<void> {
  section('RW 5: Mixed-Language Queries — Robustness');

  await withTmpDir(async (dir) => {
    const indexPath = join(dir, 'index.md');
    await writeFile(indexPath, [
      '# Shift AX Global Index',
      '',
      '## Work Types',
      '',
      '- Auth token rotation policy -> work-types/auth.md',
      '- Payment webhook handling -> work-types/payment.md',
      '- 배포 가이드 -> work-types/deploy.md',
      '',
    ].join('\n'), 'utf8');

    await mkdir(join(dir, 'work-types'), { recursive: true });
    await writeFile(join(dir, 'work-types', 'auth.md'), '# Auth Token Rotation\n\nToken rotation rules.\n', 'utf8');
    await writeFile(join(dir, 'work-types', 'payment.md'), '# Payment Webhook\n\nWebhook handling rules.\n', 'utf8');
    await writeFile(join(dir, 'work-types', 'deploy.md'), '# 배포 가이드\n\n배포 및 롤백 절차.\n', 'utf8');

    const queries: Array<{ query: string; minMatches: number; desc: string }> = [
      { query: 'auth token rotation', minMatches: 1, desc: 'english-only query' },
      { query: 'auth 토큰 rotation policy', minMatches: 1, desc: 'mixed Korean/English query' },
      { query: 'payment webhook 결제 처리', minMatches: 1, desc: 'mixed payment query' },
    ];

    let passed_count = 0;

    for (const { query, minMatches, desc } of queries) {
      const result = await resolveContextFromIndex({ rootDir: dir, indexPath, query, maxMatches: 5 });

      if (result.matches.length >= minMatches) {
        passed_count++;
        pass(`multilingual (${desc}): ${result.matches.length} match(es) returned`);
      } else {
        fail(`multilingual (${desc}): expected ≥${minMatches} matches, got ${result.matches.length}`);
      }
    }

    const pct = Math.round((passed_count / queries.length) * 100);
    console.log(`\n  Multilingual Query Robustness: ${passed_count}/${queries.length} = ${pct}%  (baseline ≥ 66%)\n`);

    if (pct < 66) fail(`METRIC multilingual robustness = ${pct}% < 66% baseline`);
    else pass(`METRIC multilingual robustness = ${pct}%`);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        shift-ax Eval Suite — Real-World Fixtures            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await evalRealisticRecall();
  await evalRealisticGlossaryCorpus();
  await evalRealisticTopicHistory();
  await evalRealisticRequestPipeline();
  await evalMultilingualQueries();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  REAL-WORLD SCORECARD                       ║');
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
  console.error('Real-world eval crashed:', err);
  process.exit(1);
});
