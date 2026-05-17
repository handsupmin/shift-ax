import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContextFromGctreeReference } from '../core/context/gctree-reference-import.js';
import { parseIndexDocument } from '../core/context/index-resolver.js';
import { runDoctor } from '../core/diagnostics/doctor.js';
import { withTempGlobalHome } from './helpers/global-home.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-gctree-reference-root-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

async function createGctreeReference(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-gctree-reference-'));
  await mkdir(join(root, 'docs', 'role'), { recursive: true });
  await mkdir(join(root, 'docs', 'repos'), { recursive: true });
  await mkdir(join(root, 'docs', 'workflows'), { recursive: true });
  await mkdir(join(root, 'docs', 'conventions'), { recursive: true });
  await mkdir(join(root, 'docs', 'domain'), { recursive: true });
  await mkdir(join(root, 'docs', 'verification'), { recursive: true });
  await writeFile(
    join(root, 'index.md'),
    [
      '# gc-tree Index',
      '',
      '- summary: Cosmo backend reference bundle.',
      '',
      '## Role',
      '',
      '- docs/role/cosmo-backend-work.md',
      '  - backend role',
      '  - Cosmo backend work',
      '',
      '## Repos',
      '',
      '- docs/repos/cosmo-backend-g3.md',
      '  - g3',
      '  - cosmo-backend-g3',
      '  - NestJS backend',
      '',
      '## Workflows',
      '',
      '- docs/workflows/db-schema-change.md',
      '  - DB schema change',
      '  - pnpm pg',
      '',
      '## Conventions',
      '',
      '- docs/conventions/cosmo-backend-g3.md',
      '  - g3 conventions',
      '  - plainToInstance',
      '',
      '## Domain',
      '',
      '- docs/domain/objekt-como-gravity.md',
      '  - Objekt',
      '  - Gravity',
      '',
      '## Verification',
      '',
      '- docs/verification/g3-default-checks.md',
      '  - pnpm type-check',
      '  - pnpm lint',
      '  - pnpm dto',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'role', 'cosmo-backend-work.md'),
    '# Role: Cosmo Backend Work\n\n## Summary\n\nPlan first, then migration, g3 API, admin UI, and verification.\n',
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'repos', 'cosmo-backend-g3.md'),
    '# Repos: cosmo-backend-g3\n\n## Summary\n\nNestJS backend repo for customer API, admin API, workers, and CLI.\n',
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'workflows', 'db-schema-change.md'),
    '# Workflows: DB Schema Change\n\n## Summary\n\nEdit model.py, generate revision, mirror cosmo.prisma, and run pnpm pg.\n',
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'conventions', 'cosmo-backend-g3.md'),
    '# Conventions: cosmo-backend-g3\n\n## Summary\n\nUse plainToInstance with satisfies and keep services free of HTTP concerns.\n',
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'domain', 'objekt-como-gravity.md'),
    '# Domain: Objekt Como Gravity\n\n## Summary\n\nObjekt, Como, and Gravity domain language.\n',
    'utf8',
  );
  await writeFile(
    join(root, 'docs', 'verification', 'g3-default-checks.md'),
    '# Verification: g3 Default Checks\n\n## Summary\n\nRun pnpm type-check, pnpm lint, and pnpm dto.\n',
    'utf8',
  );
  return root;
}

test('onboardProjectContextFromGctreeReference imports gc-tree bundles as usable Shift AX global knowledge', async () => {
  const root = await createGitRepo();
  const reference = await createGctreeReference();

  try {
    await withTempGlobalHome('shift-ax-gctree-reference-home-', async (home) => {
      const settings = {
        version: 1,
        updated_at: '2026-05-17T00:00:00.000Z',
        locale: 'ko',
        preferred_language: 'korean',
      };
      await writeFile(join(home, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

      const result = await onboardProjectContextFromGctreeReference({
        rootDir: root,
        referenceDir: reference,
      });

      const index = await readFile(join(home, 'index.md'), 'utf8');
      const entries = parseIndexDocument(index);
      const labels = entries.map((entry) => entry.label.toLowerCase());
      const preservedSettings = JSON.parse(await readFile(join(home, 'settings.json'), 'utf8')) as typeof settings;
      const copiedRepoDoc = await readFile(join(home, 'repos', 'cosmo-backend-g3.md'), 'utf8');
      const profile = JSON.parse(await readFile(join(home, 'profile.json'), 'utf8')) as {
        engineering_defaults: { verification_commands: string[] };
      };
      const doctor = await runDoctor({ rootDir: root });

      assert.equal(result.sharePath, home);
      assert.match(index, /cosmo-backend-g3 -> repos\/cosmo-backend-g3\.md/);
      assert.match(index, /DB Schema Change -> work-types\/db-schema-change\.md/);
      assert.match(index, /g3 conventions -> procedures\/conventions--cosmo-backend-g3\.md/);
      assert.match(index, /Objekt Como Gravity -> domain-language\/objekt-como-gravity\.md/);
      assert.equal(labels.length, new Set(labels).size);
      assert.deepEqual(preservedSettings, settings);
      assert.match(copiedRepoDoc, /NestJS backend repo/);
      assert.deepEqual(profile.engineering_defaults.verification_commands, [
        'pnpm type-check',
        'pnpm lint',
        'pnpm dto',
      ]);
      assert.equal(doctor.overall_status, 'ok');
    });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(reference, { recursive: true, force: true });
  }
});
