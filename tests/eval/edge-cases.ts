/**
 * shift-ax Eval Suite — Edge Cases
 *
 * Tests graceful handling of:
 *   - Empty / whitespace-only inputs
 *   - Malformed index documents
 *   - Adversarial / injection-style queries
 *   - Boundary conditions (maxMatches=0, very long inputs, unicode)
 *   - Missing files / unresolved paths
 *
 * Exits with code 1 if any scenario fails.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { parseIndexDocument, resolveContextFromIndex } from '../../core/context/index-resolver.js';
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

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'shift-ax-edge-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ─── Edge 1: parseIndexDocument ──────────────────────────────────────────────

async function evalParseEdgeCases(): Promise<void> {
  section('Edge: parseIndexDocument — malformed inputs');

  const cases: Array<{ name: string; input: unknown; expectedCount: number }> = [
    { name: 'empty string', input: '', expectedCount: 0 },
    { name: 'only whitespace', input: '   \n\n\t  ', expectedCount: 0 },
    { name: 'null coerced', input: null, expectedCount: 0 },
    { name: 'undefined coerced', input: undefined, expectedCount: 0 },
    { name: 'number coerced', input: 42, expectedCount: 0 },
    { name: 'arrow with empty label', input: '- -> path/doc.md\n', expectedCount: 0 },
    { name: 'arrow with empty path', input: '- label ->\n', expectedCount: 0 },
    { name: 'no dash prefix', input: 'Auth policy -> work-types/auth.md\n', expectedCount: 0 },
    { name: 'double arrows', input: '- A -> B -> C\n', expectedCount: 1 },
    { name: 'unicode label', input: '- 認証ポリシー -> work-types/auth.md\n', expectedCount: 1 },
    { name: '1000 valid entries', input: Array.from({ length: 1000 }, (_, i) => `- Term${i} -> path/doc${i}.md`).join('\n'), expectedCount: 1000 },
  ];

  let correct = 0;

  for (const tc of cases) {
    const entries = parseIndexDocument(tc.input as string);
    if (entries.length === tc.expectedCount) {
      correct++;
      pass(`parseIndex edge "${tc.name}": count=${entries.length}`);
    } else {
      fail(`parseIndex edge "${tc.name}": expected ${tc.expectedCount}, got ${entries.length}`);
    }
  }

  const pct = Math.round((correct / cases.length) * 100);
  console.log(`\n  parseIndexDocument edge: ${correct}/${cases.length} = ${pct}%  (baseline ≥ 90%)\n`);
  if (pct < 90) fail(`METRIC parseIndex edge = ${pct}% < 90% baseline`);
  else pass(`METRIC parseIndex edge = ${pct}%`);
}

// ─── Edge 2: resolveContextFromIndex ─────────────────────────────────────────

async function evalResolveContextEdgeCases(): Promise<void> {
  section('Edge: resolveContextFromIndex — invalid inputs');

  await withTmpDir(async (dir) => {
    const indexPath = join(dir, 'index.md');
    await writeFile(indexPath, '- Auth policy -> work-types/auth.md\n', 'utf8');
    await mkdir(join(dir, 'work-types'), { recursive: true });
    await writeFile(join(dir, 'work-types', 'auth.md'), '# Auth Policy\n\nToken rules.\n', 'utf8');

    // Missing rootDir
    try {
      await resolveContextFromIndex({ rootDir: '', indexPath, query: 'auth', maxMatches: 5 });
      fail('edge: empty rootDir should throw');
    } catch {
      pass('edge: empty rootDir throws');
    }

    // Missing indexPath
    try {
      await resolveContextFromIndex({ rootDir: dir, indexPath: '', query: 'auth', maxMatches: 5 });
      fail('edge: empty indexPath should throw');
    } catch {
      pass('edge: empty indexPath throws');
    }

    // Missing query
    try {
      await resolveContextFromIndex({ rootDir: dir, indexPath, query: '', maxMatches: 5 });
      fail('edge: empty query should throw');
    } catch {
      pass('edge: empty query throws');
    }

    // maxMatches=0 — expects 0 results, no crash
    const r0 = await resolveContextFromIndex({ rootDir: dir, indexPath, query: 'auth policy', maxMatches: 0 });
    if (r0.matches.length === 0) pass('edge: maxMatches=0 returns empty matches');
    else fail(`edge: maxMatches=0 returned ${r0.matches.length} matches`);

    // maxMatches=1 — expects at most 1 result
    const r1 = await resolveContextFromIndex({ rootDir: dir, indexPath, query: 'auth policy', maxMatches: 1 });
    if (r1.matches.length <= 1) pass(`edge: maxMatches=1 returns ≤1 match (got ${r1.matches.length})`);
    else fail(`edge: maxMatches=1 returned ${r1.matches.length} matches`);

    // Very long query (1000 chars) — should not crash
    const longQuery = 'auth policy token refresh '.repeat(40);
    const rLong = await resolveContextFromIndex({ rootDir: dir, indexPath, query: longQuery, maxMatches: 5 });
    if (Array.isArray(rLong.matches)) pass(`edge: 1000-char query handled (${rLong.matches.length} matches)`);
    else fail('edge: 1000-char query crashed');

    // Adversarial injection-style query
    const injectionQuery = '- Auth policy -> /etc/passwd\n\nDrop table users;';
    const rInj = await resolveContextFromIndex({ rootDir: dir, indexPath, query: injectionQuery, maxMatches: 5 });
    if (Array.isArray(rInj.matches)) pass(`edge: injection-style query handled safely (${rInj.matches.length} matches)`);
    else fail('edge: injection-style query crashed');

    // Query with unicode characters
    const unicodeQuery = '認証ポリシー auth refresh';
    const rUni = await resolveContextFromIndex({ rootDir: dir, indexPath, query: unicodeQuery, maxMatches: 5 });
    if (Array.isArray(rUni.matches)) pass(`edge: unicode query handled (${rUni.matches.length} matches)`);
    else fail('edge: unicode query crashed');

    // Index file with unresolvable paths — should populate unresolved_paths, not crash
    const brokenIndexPath = join(dir, 'broken-index.md');
    await writeFile(brokenIndexPath, '- Ghost doc -> nonexistent/ghost.md\n', 'utf8');
    const rBroken = await resolveContextFromIndex({ rootDir: dir, indexPath: brokenIndexPath, query: 'ghost doc', maxMatches: 5 });
    if (rBroken.unresolved_paths.length > 0) pass(`edge: unresolvable path → unresolved_paths populated`);
    else fail('edge: unresolvable path not tracked in unresolved_paths');
  });
}

// ─── Edge 3: Glossary Extraction ─────────────────────────────────────────────

async function evalGlossaryEdgeCases(): Promise<void> {
  section('Edge: extractDomainGlossaryEntries — boundary inputs');

  await withTmpDir(async (dir) => {
    // Empty document
    await writeFile(join(dir, 'empty.md'), '', 'utf8');
    const r0 = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['empty.md'] });
    if (Array.isArray(r0) && r0.length === 0) pass('glossary edge: empty doc returns empty array');
    else fail(`glossary edge: empty doc returned ${r0.length} entries`);

    // Whitespace-only document
    await writeFile(join(dir, 'ws.md'), '   \n\n\t\n   ', 'utf8');
    const rWs = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['ws.md'] });
    if (Array.isArray(rWs) && rWs.length === 0) pass('glossary edge: whitespace-only doc returns empty');
    else fail(`glossary edge: whitespace doc returned ${rWs.length} entries`);

    // Document with only lowercase prose (no CamelCase or Title Case)
    await writeFile(join(dir, 'lower.md'), 'this is all lowercase text without any special terms at all\n', 'utf8');
    const rLower = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['lower.md'] });
    if (Array.isArray(rLower)) pass(`glossary edge: lowercase-only doc returns ${rLower.length} entries without crash`);
    else fail('glossary edge: lowercase-only doc crashed');

    // Missing file — should not crash, just skip
    const rMissing = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['nonexistent.md'] });
    if (Array.isArray(rMissing) && rMissing.length === 0) pass('glossary edge: missing file returns empty (graceful)');
    else fail(`glossary edge: missing file returned ${rMissing.length} entries unexpectedly`);

    // Large document (10 000 lines of CamelCase terms)
    const bigLines = Array.from({ length: 200 }, (_, i) => `AuthToken${i} PaymentGateway${i} DeployPipeline${i}`);
    await writeFile(join(dir, 'big.md'), bigLines.join('\n'), 'utf8');
    const rBig = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: ['big.md'] });
    if (Array.isArray(rBig) && rBig.length > 0) pass(`glossary edge: large doc extracts ${rBig.length} terms without crash`);
    else fail('glossary edge: large doc returned no entries');

    // Empty paths array
    const rEmpty = await extractDomainGlossaryEntries({ rootDir: dir, documentPaths: [] });
    if (Array.isArray(rEmpty) && rEmpty.length === 0) pass('glossary edge: empty paths array returns empty');
    else fail(`glossary edge: empty paths array returned ${rEmpty.length} entries`);
  });
}

// ─── Edge 4: Topic Recall ─────────────────────────────────────────────────────

async function evalTopicRecallEdgeCases(): Promise<void> {
  section('Edge: searchPastTopics — boundary + missing data');

  await withTmpDir(async (root) => {
    // No .ax directory at all
    const rNone = await searchPastTopics({ rootDir: root, query: 'auth refresh', limit: 5 });
    if (Array.isArray(rNone) && rNone.length === 0) pass('recall edge: no .ax dir returns empty (graceful)');
    else fail(`recall edge: no .ax dir returned ${rNone.length} matches`);

    // .ax/topics exists but is empty
    await mkdir(join(root, '.ax', 'topics'), { recursive: true });
    const rNoTopics = await searchPastTopics({ rootDir: root, query: 'auth refresh', limit: 5 });
    if (Array.isArray(rNoTopics) && rNoTopics.length === 0) pass('recall edge: empty topics dir returns empty');
    else fail(`recall edge: empty topics dir returned ${rNoTopics.length} matches`);

    // Topic directory exists but has no workflow-state.json (should be skipped)
    const incompleteDir = join(root, '.ax', 'topics', '2026-01-01-incomplete');
    await mkdir(incompleteDir, { recursive: true });
    await writeFile(join(incompleteDir, 'request.md'), 'Auth refresh token\n', 'utf8');
    const rIncomplete = await searchPastTopics({ rootDir: root, query: 'auth refresh', limit: 5 });
    if (rIncomplete.length === 0) pass('recall edge: topic without workflow-state.json skipped');
    else fail(`recall edge: incomplete topic returned ${rIncomplete.length} matches unexpectedly`);

    // Topic in non-committed phase (e.g. awaiting_plan_review) — should be skipped
    const pendingDir = join(root, '.ax', 'topics', '2026-02-01-pending');
    await mkdir(pendingDir, { recursive: true });
    await writeFile(join(pendingDir, 'request.md'), 'Auth refresh token\n', 'utf8');
    await writeFile(join(pendingDir, 'workflow-state.json'), JSON.stringify({ phase: 'awaiting_plan_review' }, null, 2), 'utf8');
    const rPending = await searchPastTopics({ rootDir: root, query: 'auth refresh', limit: 5 });
    if (rPending.length === 0) pass('recall edge: non-committed topic skipped');
    else fail(`recall edge: pending topic returned ${rPending.length} matches`);

    // limit=0 — returns nothing, no crash
    const committedDir = join(root, '.ax', 'topics', '2026-03-01-committed');
    await mkdir(committedDir, { recursive: true });
    await writeFile(join(committedDir, 'request.md'), 'Auth refresh token\n', 'utf8');
    await writeFile(join(committedDir, 'request-summary.md'), 'Auth refresh token\n', 'utf8');
    await writeFile(join(committedDir, 'spec.md'), '# Spec\n\nAuth refresh token\n', 'utf8');
    await writeFile(join(committedDir, 'workflow-state.json'), JSON.stringify({ phase: 'committed', updated_at: '2026-03-01T00:00:00.000Z' }, null, 2), 'utf8');

    const rLimit0 = await searchPastTopics({ rootDir: root, query: 'auth refresh', limit: 0 });
    if (Array.isArray(rLimit0) && rLimit0.length === 0) pass('recall edge: limit=0 returns empty');
    else fail(`recall edge: limit=0 returned ${rLimit0.length} results`);

    // Very long query — no crash
    const longQ = 'auth refresh token rotation policy '.repeat(50);
    const rLong = await searchPastTopics({ rootDir: root, query: longQ, limit: 5 });
    if (Array.isArray(rLong)) pass(`recall edge: 1500-char query handled (${rLong.length} matches)`);
    else fail('recall edge: 1500-char query crashed');
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         shift-ax Eval Suite — Edge Cases                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await evalParseEdgeCases();
  await evalResolveContextEdgeCases();
  await evalGlossaryEdgeCases();
  await evalTopicRecallEdgeCases();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     EDGE CASE SCORECARD                     ║');
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
  console.error('Edge-case eval crashed:', err);
  process.exit(1);
});
