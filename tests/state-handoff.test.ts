import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeRootStateSummary, writeTopicHandoff } from '../core/observability/state-handoff.js';

async function seedTopic(root: string, slug: string, phase: string, reviewStatus: string) {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(join(topicDir, 'review'), { recursive: true });
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: slug,
        phase,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_review_status: 'approved',
        review: {
          overall_status: reviewStatus,
          commit_allowed: reviewStatus === 'approved',
          next_stage: reviewStatus === 'approved' ? 'finalization' : 'implementation',
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'execution-state.json'),
    JSON.stringify({ version: 1, overall_status: 'completed', tasks: [] }, null, 2),
    'utf8',
  );
  return topicDir;
}

test('writeRootStateSummary writes a readable .ax/STATE.md with active topics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-state-summary-'));

  try {
    await seedTopic(root, '2026-04-09-refund-fix', 'implementation_running', 'changes_requested');
    await seedTopic(root, '2026-04-09-auth-fix', 'commit_ready', 'approved');

    const result = await writeRootStateSummary({ rootDir: root, limit: 10 });
    const content = await readFile(result.output_path, 'utf8');

    assert.match(content, /Shift AX State/i);
    assert.match(content, /2026-04-09-refund-fix/);
    assert.match(content, /implementation_running/);
    assert.match(content, /2026-04-09-auth-fix/);
    assert.match(content, /commit_ready/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeTopicHandoff writes a topic handoff with next step and operator commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-handoff-'));

  try {
    const topicDir = await seedTopic(root, '2026-04-09-refund-fix', 'implementation_running', 'changes_requested');
    const result = await writeTopicHandoff({
      topicDir,
      summary: 'Stopping at the end of the work day.',
      nextStep: 'Resume implementation and rerun review.',
      commands: ['npm run ax -- topic-status --topic .ax/topics/2026-04-09-refund-fix'],
    });
    const content = await readFile(result.output_path, 'utf8');

    assert.match(content, /Stopping at the end of the work day/);
    assert.match(content, /Resume implementation and rerun review/);
    assert.match(content, /topic-status/);
    assert.match(content, /changes_requested/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
