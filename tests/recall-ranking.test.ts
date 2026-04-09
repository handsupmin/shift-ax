import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { searchDecisionMemory } from '../core/memory/decision-register.js';
import { searchPastTopics } from '../core/memory/topic-recall.js';
import { recordDecision } from '../core/memory/decision-register.js';

async function seedCommittedTopic(root: string, slug: string, summary: string, updatedAt: string): Promise<void> {
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
        created_at: updatedAt,
        updated_at: updatedAt,
        plan_review_status: 'approved',
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('searchPastTopics prefers stronger lexical match, then newer committed topics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-ranking-'));

  try {
    await seedCommittedTopic(root, '2026-04-08-refund-fix', 'Refund rollback helper', '2026-04-08T00:00:00.000Z');
    await seedCommittedTopic(root, '2026-04-09-refund-fix-newer', 'Refund rollback helper', '2026-04-09T00:00:00.000Z');

    const matches = await searchPastTopics({
      rootDir: root,
      query: 'refund rollback helper',
      limit: 2,
    });

    assert.equal(matches[0]?.topic_slug, '2026-04-09-refund-fix-newer');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('searchDecisionMemory prefers stronger lexical match, then newer linked source topics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-ranking-'));

  try {
    await seedCommittedTopic(root, '2026-04-08-refund-fix', 'Refund rollback helper', '2026-04-08T00:00:00.000Z');
    await seedCommittedTopic(root, '2026-04-09-refund-fix-newer', 'Refund rollback helper', '2026-04-09T00:00:00.000Z');
    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-08',
      sourceTopic: '2026-04-08-refund-fix',
    });
    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
      sourceTopic: '2026-04-09-refund-fix-newer',
    });

    const matches = await searchDecisionMemory({
      rootDir: root,
      query: 'refund rollback traceability',
      limit: 2,
    });

    assert.equal(matches[0]?.source_topic, '2026-04-09-refund-fix-newer');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
