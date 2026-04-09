import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readTeamPreferences, writeTeamPreferences } from '../core/policies/team-preferences.js';

test('writeTeamPreferences stores a lightweight support-only team preference profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-team-preferences-'));

  try {
    await writeTeamPreferences({
      rootDir: root,
      preferences: {
        implementation_style: 'small reversible changes',
        review_style: 'explicit rollback risk callouts',
      },
    });

    const prefs = await readTeamPreferences(root);
    assert.equal(prefs?.implementation_style, 'small reversible changes');
    assert.equal(prefs?.review_style, 'explicit rollback risk callouts');
    const raw = await readFile(join(root, '.ax', 'team-preferences.json'), 'utf8');
    assert.match(raw, /small reversible changes/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
