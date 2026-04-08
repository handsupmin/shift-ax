import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContextFromDiscovery } from '../core/context/onboarding.js';
import { readProjectProfile } from '../core/policies/project-profile.js';

test('onboardProjectContextFromDiscovery seeds the base-context index from existing docs', async () => {
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

    const result = await onboardProjectContextFromDiscovery({ rootDir: root });
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const profile = await readProjectProfile(root);

    assert.equal(result.documents.length, 2);
    assert.match(index, /System Overview -> docs\/architecture\/system-overview.md/);
    assert.match(index, /Auth Policy -> docs\/policies\/auth-policy.md/);
    assert.equal(profile?.context_docs.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
