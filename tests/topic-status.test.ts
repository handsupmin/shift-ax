import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { summarizeTopicStatus } from '../core/observability/topic-status.js';

test('summarizeTopicStatus returns a compact view of workflow, review, execution, and lifecycle state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-status-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');

  try {
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await mkdir(join(topicDir, 'final'), { recursive: true });

    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-auth-refresh',
          phase: 'review_pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'execution-state.json'),
      JSON.stringify(
        {
          version: 1,
          overall_status: 'completed',
          tasks: [
            {
              task_id: 'task-1',
              execution_mode: 'subagent',
              status: 'completed',
              output_path: 'execution-results/task-1.json',
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'review', 'aggregate.json'),
      JSON.stringify(
        {
          version: 1,
          overall_status: 'changes_requested',
          commit_allowed: false,
          next_stage: 'implementation',
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'lifecycle-log.json'),
      JSON.stringify(
        [
          {
            phase: 'implementation_running',
            event: 'execution.started',
            summary: 'Execution started.',
            recorded_at: '2026-04-08T00:00:00.000Z',
          },
          {
            phase: 'review_pending',
            event: 'review.completed',
            summary: 'Review requested changes.',
            recorded_at: '2026-04-08T00:10:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'reaction-log.json'),
      JSON.stringify(
        [
          {
            key: 'review-changes-requested',
            action: 'return_to_implementation',
            outcome: 'changes_requested',
            recorded_at: '2026-04-08T00:10:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    const summary = await summarizeTopicStatus(topicDir);

    assert.equal(summary.topic_slug, '2026-04-08-auth-refresh');
    assert.equal(summary.phase, 'review_pending');
    assert.equal(summary.review_status, 'changes_requested');
    assert.equal(summary.execution_status, 'completed');
    assert.equal(summary.last_event?.event, 'review.completed');
    assert.equal(summary.last_reaction?.key, 'review-changes-requested');
    assert.match(summary.last_failure_reason ?? '', /changes/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
