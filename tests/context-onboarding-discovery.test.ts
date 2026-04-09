import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContextFromDiscovery } from '../core/context/onboarding.js';
import { readProjectProfile } from '../core/policies/project-profile.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('onboardProjectContextFromDiscovery migrates discovered docs into the global knowledge home', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboard-discovery-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await mkdir(join(root, 'docs', 'policies'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nArchitecture details.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'policies', 'auth-policy.md'),
      '# Auth Policy\n\nRotation is required.\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-discovery-home-', async (home) => {
      const result = await onboardProjectContextFromDiscovery({ rootDir: root });
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const profile = await readProjectProfile(root);

      assert.ok(result.documents.length >= 3);
      assert.match(index, /Repository Context -> work-types\/repository-context.md/);
      assert.equal(profile?.context_docs.some((entry) => entry.path === 'work-types/repository-context.md'), true);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
