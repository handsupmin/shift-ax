import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { saveThreadNote } from '../core/memory/threads.js';
import { promoteThreadToTopic } from '../core/memory/thread-promotion.js';

test('promoteThreadToTopic creates a new topic from a thread note', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-thread-promotion-'));

  try {
    await mkdir(join(root, '.git'), { recursive: true });
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track refund migration decisions.',
      note: 'Need a dedicated topic for rollback semantics.',
    });

    const result = await promoteThreadToTopic({
      rootDir: root,
      name: 'refund-migration',
      request: 'Create refund rollback topic',
    });

    const supportThread = await readFile(result.supportPath, 'utf8');
    assert.match(supportThread, /refund migration/i);
    const brainstorm = await readFile(join(result.topicDir, 'brainstorm.md'), 'utf8');
    assert.doesNotMatch(brainstorm, /Imported Thread/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
