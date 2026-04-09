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
import { withTempGlobalHome } from './helpers/global-home.js';

test('writeProjectProfile round-trips engineering defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-profile-'));

  try {
    await withTempGlobalHome('shift-ax-profile-home-', async (home) => {
      await writeProjectProfile(root, {
        version: 1,
        updated_at: new Date().toISOString(),
        docs_root: home,
        index_path: 'index.md',
        context_docs: [{ label: 'API development', path: 'work-types/api-development.md' }],
        onboarding_context: {
          primary_role_summary: 'I mainly ship API and ledger changes.',
          work_types: ['API development', 'Ledger maintenance'],
          domain_language: ['LedgerX', 'SettlementWindow'],
        },
        engineering_defaults: {
          ...defaultEngineeringDefaults(),
          architecture: 'layered-boundaries',
        },
      });

      const profile = await readProjectProfile(root);

      assert.equal(getProjectProfilePath(root), join(home, 'profile.json'));
      assert.ok(profile);
      assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
      assert.equal(profile?.engineering_defaults.architecture, 'layered-boundaries');
      assert.equal(profile?.context_docs[0]?.label, 'API development');
      assert.equal(profile?.onboarding_context?.work_types[0], 'API development');
      assert.match(profile?.onboarding_context?.primary_role_summary ?? '', /API and ledger/i);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
