import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax thread-save and ax threads manage cross-topic thread notes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-threads-cli-'));

  try {
    const run = (args: string[]) =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', ...args],
          {
            cwd: REPO_ROOT,
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
          else reject(new Error(error || `ax threads command exited ${code}`));
        });
      });

    await run([
      'thread-save',
      '--root',
      root,
      '--name',
      'refund-migration',
      '--summary',
      'Track refund migration decisions.',
      '--note',
      'Need a shared rollback policy.',
    ]);

    const listed = await run(['threads', '--root', root]);
    const result = JSON.parse(listed) as Array<{ name: string }>;
    assert.equal(result[0]?.name, 'refund-migration');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
