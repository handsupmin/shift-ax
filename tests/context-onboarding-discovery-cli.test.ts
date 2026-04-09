import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withTempGlobalHome } from './helpers/global-home.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax-onboard-context --discover seeds the index from existing docs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboard-discovery-cli-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nArchitecture details.\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-discovery-cli-home-', async (home) => {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax-onboard-context.ts', '--root', root, '--discover'],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              SHIFT_AX_HOME: home,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );

        let output = '';
        let error = '';
        child.stdout.on('data', (chunk) => {
          output += chunk.toString('utf8');
        });
        child.stderr.on('data', (chunk) => {
          error += chunk.toString('utf8');
        });
        child.on('exit', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(error || `ax-onboard-context exited ${code}`));
        });
      });

      const result = JSON.parse(stdout) as { documents: Array<{ path: string }> };
      const index = await readFile(join(home, 'index.md'), 'utf8');

      assert.ok(result.documents.some((doc) => doc.path === 'work-types/repository-context.md'));
      assert.match(index, /Repository Context -> work-types\/repository-context.md/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
