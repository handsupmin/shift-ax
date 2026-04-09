import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordDecision } from '../core/memory/decision-register.js';
import { saveThreadNote } from '../core/memory/threads.js';
import { consolidateMemory } from '../core/memory/consolidation.js';

async function seedCommittedTopic(root: string, slug: string, summary: string): Promise<void> {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(topicDir, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'spec.md'), `# Topic Spec\n\n${summary}\n`, 'utf8');
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: slug,
        phase: 'committed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_review_status: 'approved',
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('consolidateMemory suggests duplicate decisions, repeated topic learnings, and glossary candidates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-consolidation-'));

  try {
    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
    });
    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-10',
    });
    await seedCommittedTopic(root, '2026-04-09-refund-fix', 'Refund rollback helper for audit traceability');
    await seedCommittedTopic(root, '2026-04-10-refund-fix', 'Refund rollback helper for audit traceability');
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track refund migration ideas.',
      note: 'Traceability and rollback semantics need a shared glossary entry.',
    });

    const result = await consolidateMemory({ rootDir: root });

    assert.ok(result.duplicate_decisions.length >= 1);
    assert.ok(result.repeated_topics.length >= 1);
    assert.ok(result.glossary_candidates.length >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
