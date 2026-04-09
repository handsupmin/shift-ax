import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeTopicSummaryCheckpoint } from '../core/memory/summary-checkpoints.js';

test('writeTopicSummaryCheckpoint writes a timestamped summary checkpoint for a topic', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-summary-checkpoint-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');

  try {
    await mkdir(topicDir, { recursive: true });
    const result = await writeTopicSummaryCheckpoint({
      topicDir,
      summary: 'Implementation paused after the policy sync review.',
      now: new Date('2026-04-09T00:00:00.000Z'),
    });

    const content = await readFile(result.output_path, 'utf8');
    assert.match(content, /Implementation paused after the policy sync review/);
    assert.match(result.output_path, /2026-04-09T00-00-00-000Z-summary\.md$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
