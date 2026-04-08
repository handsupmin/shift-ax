import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { searchPastTopics } from '../core/memory/topic-recall.js';

async function seedTopic(root: string, slug: string, request: string, summary: string, spec: string) {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(topicDir, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), `${request}\n`, 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'spec.md'), `${spec}\n`, 'utf8');
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

test('searchPastTopics finds the most relevant completed topic artifacts for a query', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-recall-'));

  try {
    await seedTopic(
      root,
      '2026-04-08-auth-refresh',
      'Build safer auth refresh flow',
      'Reviewed auth refresh delivery flow.',
      '# Topic Spec\n\nKeep users signed in during token rotation.\n',
    );
    await seedTopic(
      root,
      '2026-04-08-billing-refund',
      'Build refund settlement guardrails',
      'Reviewed billing refund flow.',
      '# Topic Spec\n\nProtect settlement batches during refund processing.\n',
    );

    const results = await searchPastTopics({
      rootDir: root,
      query: 'auth token rotation',
      limit: 5,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.topic_slug, '2026-04-08-auth-refresh');
    assert.match(results[0]?.summary ?? '', /auth refresh/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('searchPastTopics ignores uncommitted or incomplete topics by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-recall-filter-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-08-incomplete');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request.md'), 'Build auth experiment\n', 'utf8');
    await writeFile(join(topicDir, 'request-summary.md'), 'Incomplete topic\n', 'utf8');
    await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\nPending\n', 'utf8');
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-incomplete',
          phase: 'implementation_running',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
        },
        null,
        2,
      ),
      'utf8',
    );

    const results = await searchPastTopics({
      rootDir: root,
      query: 'auth experiment',
    });

    assert.equal(results.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
