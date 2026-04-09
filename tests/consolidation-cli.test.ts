import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax consolidate-memory prints structured consolidation suggestions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-consolidation-cli-'));

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'consolidate-memory', '--root', root],
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
        else reject(new Error(error || `ax consolidate-memory exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { duplicate_decisions: unknown[]; repeated_topics: unknown[] };
    assert.ok(Array.isArray(result.duplicate_decisions));
    assert.ok(Array.isArray(result.repeated_topics));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
