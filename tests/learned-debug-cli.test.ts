import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax learned-debug-save and ax learned-debug persist and retrieve reusable debug notes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-learned-debug-cli-'));

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
          else reject(new Error(error || `ax learned-debug command exited ${code}`));
        });
      });

    await run([
      'learned-debug-save',
      '--root',
      root,
      '--summary',
      'Repeated tmux session collision on rerun.',
      '--resolution',
      'Clear stale session before relaunch.',
      '--occurrences',
      '2',
      '--fix-commit',
      'abc123',
    ]);

    const listed = await run(['learned-debug', '--root', root, '--query', 'tmux collision']);
    const result = JSON.parse(listed) as Array<{ summary: string }>;
    assert.equal(result.length, 1);
    assert.match(result[0]?.summary ?? '', /tmux session collision/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
