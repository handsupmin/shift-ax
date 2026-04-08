import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listTopicsStatus } from '../core/observability/topics-status.js';

test('listTopicsStatus returns compact summaries for tracked topics ordered by update time', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topics-status-'));

  try {
    const first = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
    const second = join(root, '.ax', 'topics', '2026-04-08-billing-window');
    await mkdir(join(first, 'review'), { recursive: true });
    await mkdir(join(second, 'review'), { recursive: true });

    await writeFile(
      join(first, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-auth-refresh',
          phase: 'implementation_running',
          created_at: '2026-04-08T00:00:00.000Z',
          updated_at: '2026-04-08T01:00:00.000Z',
          plan_review_status: 'approved',
          review: {
            overall_status: 'changes_requested',
            commit_allowed: false,
            next_stage: 'implementation',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(first, 'execution-state.json'),
      JSON.stringify({ version: 1, overall_status: 'completed', tasks: [] }, null, 2),
      'utf8',
    );
    await writeFile(
      join(first, 'review', 'aggregate.json'),
      JSON.stringify({ version: 1, overall_status: 'changes_requested', commit_allowed: false, next_stage: 'implementation' }, null, 2),
      'utf8',
    );

    await writeFile(
      join(second, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-billing-window',
          phase: 'committed',
          created_at: '2026-04-08T00:00:00.000Z',
          updated_at: '2026-04-08T02:00:00.000Z',
          plan_review_status: 'approved',
          review: {
            overall_status: 'approved',
            commit_allowed: true,
            next_stage: 'finalization',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(second, 'execution-state.json'),
      JSON.stringify({ version: 1, overall_status: 'completed', tasks: [] }, null, 2),
      'utf8',
    );
    await writeFile(
      join(second, 'review', 'aggregate.json'),
      JSON.stringify({ version: 1, overall_status: 'approved', commit_allowed: true, next_stage: 'finalization' }, null, 2),
      'utf8',
    );

    const summaries = await listTopicsStatus({
      rootDir: root,
      limit: 10,
    });

    assert.equal(summaries.length, 2);
    assert.equal(summaries[0]?.topic_slug, '2026-04-08-billing-window');
    assert.equal(summaries[1]?.topic_slug, '2026-04-08-auth-refresh');
    assert.equal(summaries[0]?.phase, 'committed');
    assert.equal(summaries[1]?.review_status, 'changes_requested');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
