import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { withTempGlobalHome } from './helpers/global-home.js';

test('ax-resolve-context defaults to docs/base-context/index.md', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-cli-context-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      ['# Base Context', '', '- Auth policy -> docs/base-context/auth-policy.md', ''].join('\n'),
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'base-context', 'auth-policy.md'),
      '# Auth Policy\n\nRotation is required.\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-resolve-home-', async (home) => {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax-resolve-context.ts', '--root', root, '--query', 'auth rotation flow'],
          {
            cwd: '/Users/sangmin/sources/shift-ax',
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
          else reject(new Error(error || `ax-resolve-context exited ${code}`));
        });
      });

      const result = JSON.parse(stdout) as { index_path: string; matches: Array<{ label: string }> };
      assert.match(result.index_path, /docs\/base-context\/index\.md$/);
      assert.equal(result.matches.length, 1);
      assert.equal(result.matches[0]!.label, 'Auth policy');
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
