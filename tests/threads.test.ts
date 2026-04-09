import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listThreads, saveThreadNote } from '../core/memory/threads.js';

test('saveThreadNote creates and appends to a cross-topic thread file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-threads-'));

  try {
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track long-running refund migration notes.',
      note: 'Need to revisit rollback semantics.',
    });
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      note: 'Auth team requested a shared decision review.',
    });

    const threads = await listThreads({ rootDir: root });
    assert.equal(threads.length, 1);
    assert.equal(threads[0]?.name, 'refund-migration');
    assert.equal(threads[0]?.slug, 'refund-migration');

    const content = await readFile(threads[0]!.path, 'utf8');
    assert.match(content, /Track long-running refund migration notes/);
    assert.match(content, /Need to revisit rollback semantics/);
    assert.match(content, /Auth team requested a shared decision review/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
