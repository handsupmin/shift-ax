import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax checkpoint-context writes a topic summary checkpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-checkpoint-cli-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');

  try {
    await mkdir(topicDir, { recursive: true });
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'checkpoint-context',
          '--topic',
          topicDir,
          '--summary',
          'Checkpoint after audit fix review.',
        ],
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
        else reject(new Error(error || `ax checkpoint-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { output_path: string };
    const content = await readFile(result.output_path, 'utf8');
    assert.match(content, /Checkpoint after audit fix review/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
