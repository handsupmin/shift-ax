import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listLearnedDebugNotes, recordLearnedDebugNote } from '../core/memory/learned-debug.js';

test('recordLearnedDebugNote stores reusable failure history when evidence threshold is met', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-learned-debug-'));

  try {
    const note = await recordLearnedDebugNote({
      rootDir: root,
      summary: 'Repeated tmux session collision on rerun.',
      resolution: 'Clear stale session before relaunch.',
      occurrences: 2,
      fixCommit: 'abc123',
    });

    const notes = await listLearnedDebugNotes({ rootDir: root });
    assert.equal(notes.length, 1);
    assert.equal(note.fix_commit, 'abc123');
    assert.match(notes[0]?.summary ?? '', /tmux session collision/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recordLearnedDebugNote rejects weak evidence notes that do not meet the save threshold', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-learned-debug-threshold-'));

  try {
    await assert.rejects(
      recordLearnedDebugNote({
        rootDir: root,
        summary: 'One-off flake.',
        resolution: 'Retry once.',
        occurrences: 1,
      }),
      /approved|occurrences|fix commit/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
