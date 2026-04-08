import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordDecision } from '../core/memory/decision-register.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax decisions lists matching active decisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decisions-cli-'));

  try {
    await recordDecision({
      rootDir: root,
      title: 'Use session cookies for auth',
      summary: 'Prefer session cookies over JWT for first-party web flows.',
      category: 'architecture',
      validFrom: '2026-04-08',
      sourceTopic: '2026-04-08-auth-refresh',
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'decisions',
          '--root',
          root,
          '--query',
          'session cookies',
          '--active-at',
          '2026-04-20',
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
        else reject(new Error(error || `ax decisions exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as Array<{ title: string }>;
    assert.equal(result.length, 1);
    assert.equal(result[0]?.title, 'Use session cookies for auth');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
