import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordDecision, searchDecisionMemory } from '../core/memory/decision-register.js';

test('searchDecisionMemory ranks decisions and pulls source topic summaries into recall results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-memory-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request-summary.md'), 'Auth refresh rollback must stay safe.\n', 'utf8');
    await writeFile(join(topicDir, 'request.md'), 'Build safer auth refresh rollback flow.\n', 'utf8');
    await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\nRollback safety is required.\n', 'utf8');
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-auth-refresh',
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
      title: 'Require rollback-safe auth refresh',
      summary: 'Refresh changes must preserve a safe rollback path for session recovery.',
      category: 'policy',
      validFrom: '2026-04-08',
      sourceTopic: '2026-04-08-auth-refresh',
      sourceDoc: 'docs/base-context/auth-policy.md',
    });
    await recordDecision({
      rootDir: root,
      title: 'Use monthly billing windows',
      summary: 'Billing runs on monthly windows for invoices.',
      category: 'finance',
      validFrom: '2026-04-08',
    });

    const results = await searchDecisionMemory({
      rootDir: root,
      query: 'auth refresh rollback',
      limit: 2,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.title, 'Require rollback-safe auth refresh');
    assert.ok((results[0]?.score ?? 0) > 0);
    assert.match(results[0]?.source_topic_summary ?? '', /rollback/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
