import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordDecision } from '../core/memory/decision-register.js';
import { saveThreadNote } from '../core/memory/threads.js';
import { buildEntityMemoryView } from '../core/memory/entity-memory.js';

test('buildEntityMemoryView combines related decisions, threads, and past topics for an entity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-entity-memory-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-09-refund-fix');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request.md'), 'Refund rollback helper\n', 'utf8');
    await writeFile(join(topicDir, 'request-summary.md'), 'Refund rollback helper\n', 'utf8');
    await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\nRefund rollback helper\n', 'utf8');
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-09-refund-fix',
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

    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
      sourceTopic: '2026-04-09-refund-fix',
    });
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track refund migration decisions.',
      note: 'Need rollback semantics to stay auditable.',
    });

    const view = await buildEntityMemoryView({
      rootDir: root,
      entity: 'refund',
    });

    assert.equal(view.entity, 'refund');
    assert.ok(view.decisions.length >= 1);
    assert.ok(view.threads.length >= 1);
    assert.ok(view.topics.length >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
