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
      onboarding_context: {
        business_context: 'B2B fintech platform for wallet and settlement flows.',
        policy_areas: ['auth', 'billing'],
        architecture_summary: 'Service-oriented API with append-only ledger.',
        risky_domains: ['payments', 'permissions'],
      },
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
    assert.equal(profile?.onboarding_context?.policy_areas[0], 'auth');
    assert.match(profile?.onboarding_context?.architecture_summary ?? '', /append-only ledger/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
