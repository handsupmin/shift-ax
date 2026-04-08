import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { readProjectProfile } from '../core/policies/project-profile.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax-onboard-context prompts interactively when no input file is provided', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-cli-'));

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax-onboard-context.ts', '--root', root],
        {
          cwd: REPO_ROOT,
          stdio: ['pipe', 'pipe', 'pipe'],
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

      child.stdin.end(
        [
          'Auth policy',
          'Refresh token rotation is required.',
          'n',
          'B2B fintech platform for wallet operations.',
          'auth, billing',
          'Service boundaries around auth and ledger.',
          'payments, permissions',
          '',
          '',
          '',
          '',
        ].join('\n') + '\n',
      );
    });

    const result = JSON.parse(stdout) as {
      documents: Array<{ label: string; path: string }>;
    };
    const doc = await readFile(join(root, 'docs', 'base-context', 'auth-policy.md'), 'utf8');
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const profile = await readProjectProfile(root);

    assert.equal(result.documents.length, 1);
    assert.equal(result.documents[0]?.label, 'Auth policy');
    assert.match(doc, /Refresh token rotation is required/);
    assert.match(index, /Auth policy -> docs\/base-context\/auth-policy.md/);
    assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
    assert.equal(profile?.engineering_defaults.long_task_execution, 'tmux');
    assert.equal(profile?.onboarding_context?.policy_areas[0], 'auth');
    assert.equal(profile?.onboarding_context?.risky_domains[1], 'permissions');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
