import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  defaultEngineeringDefaults,
  getProjectProfilePath,
  readProjectProfile,
  writeProjectProfile,
} from '../core/policies/project-profile.js';

test('writeProjectProfile round-trips engineering defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-profile-'));

  try {
    await writeProjectProfile(root, {
      version: 1,
      updated_at: new Date().toISOString(),
      docs_root: 'docs/base-context',
      index_path: 'docs/base-context/index.md',
      context_docs: [{ label: 'Auth policy', path: 'docs/base-context/auth-policy.md' }],
      engineering_defaults: {
        ...defaultEngineeringDefaults(),
        architecture: 'layered-boundaries',
      },
    });

    const profile = await readProjectProfile(root);

    assert.equal(getProjectProfilePath(root), join(root, '.ax', 'project-profile.json'));
    assert.ok(profile);
    assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
    assert.equal(profile?.engineering_defaults.architecture, 'layered-boundaries');
    assert.equal(profile?.context_docs[0]?.label, 'Auth policy');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
