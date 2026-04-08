import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordLifecycleEvent, readLifecycleEvents } from '../core/planning/lifecycle-events.js';

test('recordLifecycleEvent appends ordered lifecycle events to a topic log', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-lifecycle-events-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');

  try {
    await mkdir(topicDir, { recursive: true });

    await recordLifecycleEvent({
      topicDir,
      phase: 'awaiting_plan_review',
      event: 'plan.review_required',
      summary: 'Waiting for the human plan review.',
    });
    await recordLifecycleEvent({
      topicDir,
      phase: 'implementation_running',
      event: 'execution.started',
      summary: 'Execution tasks started.',
    });

    const events = await readLifecycleEvents(topicDir);

    assert.equal(events.length, 2);
    assert.equal(events[0]?.event, 'plan.review_required');
    assert.equal(events[1]?.event, 'execution.started');
    assert.equal(events[1]?.phase, 'implementation_running');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recordLifecycleEvent can also persist a reaction record when automation handles a failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-lifecycle-reaction-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');

  try {
    await mkdir(topicDir, { recursive: true });

    await recordLifecycleEvent({
      topicDir,
      phase: 'implementation_running',
      event: 'execution.blocked',
      summary: 'Execution stopped on an auth policy conflict.',
      reaction: {
        key: 'policy-conflict',
        action: 'await_human_escalation',
        outcome: 'blocked',
      },
    });

    const reactions = JSON.parse(
      await readFile(join(topicDir, 'reaction-log.json'), 'utf8'),
    ) as Array<{ key: string; action: string; outcome: string }>;

    assert.equal(reactions.length, 1);
    assert.equal(reactions[0]?.key, 'policy-conflict');
    assert.equal(reactions[0]?.action, 'await_human_escalation');
    assert.equal(reactions[0]?.outcome, 'blocked');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
