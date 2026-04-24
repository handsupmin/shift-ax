/**
 * shift-ax Eval Suite — Performance
 *
 * Measures latency and throughput for core operations:
 *   - Context resolver: p50 / p95 latency
 *   - Glossary extraction: p50 / p95 latency
 *   - Topic recall: p50 / p95 latency
 *   - Throughput: queries per second under sequential load
 *
 * Baselines (measured on Apple M-series, NVMe SSD):
 *   context resolver p50  ≤ 20ms
 *   context resolver p95  ≤ 60ms
 *   glossary extract p50  ≤ 30ms
 *   topic recall     p50  ≤ 15ms
 *
 * Exits with code 1 if any baseline is exceeded.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { resolveContextFromIndex } from '../../core/context/index-resolver.js';
import { extractDomainGlossaryEntries } from '../../core/context/glossary.js';
import { searchPastTopics } from '../../core/memory/topic-recall.js';

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

function percentile(sortedMs: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.max(0, idx)]!;
}

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'shift-ax-perf-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ─── Perf 1: Context Resolver latency ────────────────────────────────────────

async function buildPerfIndex(dir: string): Promise<string> {
  const ENTRIES = 50;
  const lines = ['# Shift AX Global Index', '', '## Work Types', ''];
  const docs: Record<string, string> = {};

  for (let i = 0; i < ENTRIES; i++) {
    const slug = `doc-${i}`;
    lines.push(`- Document ${i} topic -> work-types/${slug}.md`);
    docs[`${slug}.md`] = `# Document ${i}\n\nContent for document ${i} covering topic area ${i}.\n`;
  }

  lines.push('');
  const indexPath = join(dir, 'index.md');
  await writeFile(indexPath, lines.join('\n'), 'utf8');
  await mkdir(join(dir, 'work-types'), { recursive: true });

  for (const [filename, content] of Object.entries(docs)) {
    await writeFile(join(dir, 'work-types', filename), content, 'utf8');
  }

  return indexPath;
}

async function evalContextResolverLatency(): Promise<void> {
  section('Perf 1: Context Resolver — Latency (N=30)');

  await withTmpDir(async (dir) => {
    const indexPath = await buildPerfIndex(dir);
    const N = 30;
    const timings: number[] = [];

    // Warm up (exclude from measurements)
    await resolveContextFromIndex({ rootDir: dir, indexPath, query: 'document topic area', maxMatches: 5 });

    for (let i = 0; i < N; i++) {
      const start = performance.now();
      await resolveContextFromIndex({ rootDir: dir, indexPath, query: `document topic area ${i % 10}`, maxMatches: 5 });
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    const min = timings[0]!;
    const max = timings[timings.length - 1]!;

    console.log(`\n  context resolver: min=${min.toFixed(1)}ms  p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  max=${max.toFixed(1)}ms\n`);

    if (p50 <= 20) pass(`METRIC context resolver p50 = ${p50.toFixed(1)}ms ≤ 20ms`);
    else fail(`METRIC context resolver p50 = ${p50.toFixed(1)}ms > 20ms baseline`);

    if (p95 <= 60) pass(`METRIC context resolver p95 = ${p95.toFixed(1)}ms ≤ 60ms`);
    else fail(`METRIC context resolver p95 = ${p95.toFixed(1)}ms > 60ms baseline`);
  });
}

// ─── Perf 2: Glossary Extraction latency ─────────────────────────────────────

async function evalGlossaryLatency(): Promise<void> {
  section('Perf 2: Glossary Extraction — Latency (N=20, 3 docs each)');

  await withTmpDir(async (dir) => {
    const docContent = [
      '# Architecture Overview',
      '',
      'The AuthService manages token issuance. PaymentOrchestrator coordinates',
      'charge attempts. The ServiceMesh provides inter-service routing.',
      'Each BoundedContext exposes a PublicApiContract versioned endpoint.',
      '',
      '## Database Layer',
      '',
      'MigrationRunner applies schema changes. RollbackStrategy ensures safety.',
      'ConnectionPoolManager handles database connections efficiently.',
      '',
    ].join('\n');

    for (let i = 0; i < 3; i++) {
      await writeFile(join(dir, `doc${i}.md`), docContent, 'utf8');
    }

    const N = 20;
    const timings: number[] = [];

    // Warm up
    await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['doc0.md', 'doc1.md', 'doc2.md'] });

    for (let i = 0; i < N; i++) {
      const start = performance.now();
      await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['doc0.md', 'doc1.md', 'doc2.md'] });
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);

    console.log(`\n  glossary extraction: p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms\n`);

    if (p50 <= 30) pass(`METRIC glossary extraction p50 = ${p50.toFixed(1)}ms ≤ 30ms`);
    else fail(`METRIC glossary extraction p50 = ${p50.toFixed(1)}ms > 30ms baseline`);
  });
}

// ─── Perf 3: Topic Recall latency ────────────────────────────────────────────

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

async function evalTopicRecallLatency(): Promise<void> {
  section('Perf 3: Topic Recall — Latency (N=25, 20 committed topics)');

  await withTmpDir(async (root) => {
    const TOPICS = 20;
    const topics = [
      'Auth refresh token rotation policy enforcement',
      'Payment webhook idempotency dead letter queue',
      'Database migration rollback strategy schema',
      'Feature flag LaunchDarkly canary rollout',
      'API versioning deprecation migration callers',
      'On-call escalation PagerDuty incident bridge',
      'Frontend bundle size performance budget webpack',
      'Data pipeline ingest latency SLA alerting',
      'Service mesh Istio routing mTLS certificates',
      'Code review security sensitive JWT signing',
    ];

    for (let i = 0; i < TOPICS; i++) {
      const summary = topics[i % topics.length]!;
      await seedCommittedTopic(root, `2026-01-${String(i + 1).padStart(2, '0')}-topic`, summary, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`);
    }

    const N = 25;
    const timings: number[] = [];

    // Warm up
    await searchPastTopics({ rootDir: root, query: 'auth refresh token rotation', limit: 5 });

    for (let i = 0; i < N; i++) {
      const query = topics[i % topics.length]!.split(' ').slice(0, 4).join(' ');
      const start = performance.now();
      await searchPastTopics({ rootDir: root, query, limit: 5 });
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);

    console.log(`\n  topic recall: p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms\n`);

    if (p50 <= 15) pass(`METRIC topic recall p50 = ${p50.toFixed(1)}ms ≤ 15ms`);
    else fail(`METRIC topic recall p50 = ${p50.toFixed(1)}ms > 15ms baseline`);

    if (p95 <= 50) pass(`METRIC topic recall p95 = ${p95.toFixed(1)}ms ≤ 50ms`);
    else fail(`METRIC topic recall p95 = ${p95.toFixed(1)}ms > 50ms baseline`);
  });
}

// ─── Perf 4: Throughput ───────────────────────────────────────────────────────

async function evalContextResolverThroughput(): Promise<void> {
  section('Perf 4: Context Resolver — Sequential Throughput');

  await withTmpDir(async (dir) => {
    const indexPath = await buildPerfIndex(dir);
    const DURATION_MS = 2000;
    let count = 0;
    const start = Date.now();

    while (Date.now() - start < DURATION_MS) {
      await resolveContextFromIndex({ rootDir: dir, indexPath, query: `document topic ${count % 10}`, maxMatches: 3 });
      count++;
    }

    const elapsed = Date.now() - start;
    const qps = Math.round((count / elapsed) * 1000);

    console.log(`\n  throughput: ${count} queries in ${elapsed}ms = ${qps} q/s  (baseline ≥ 50 q/s)\n`);

    if (qps >= 50) pass(`METRIC context resolver throughput = ${qps} q/s ≥ 50 q/s`);
    else fail(`METRIC context resolver throughput = ${qps} q/s < 50 q/s baseline`);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       shift-ax Eval Suite — Performance Metrics             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('  Note: latency baselines target Apple M-series / NVMe SSD.\n');
  console.log('  Slower hardware will produce higher numbers — adjust if needed.\n');

  await evalContextResolverLatency();
  await evalGlossaryLatency();
  await evalTopicRecallLatency();
  await evalContextResolverThroughput();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  PERFORMANCE SCORECARD                      ║');
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
  console.error('Performance eval crashed:', err);
  process.exit(1);
});
