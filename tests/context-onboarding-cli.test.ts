import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
          '1',
          'B2B fintech platform for wallet operations.',
          'It handles auth refresh and wallet funding flows.',
          'auth, billing',
          'payments, permissions',
          'Service boundaries around auth and ledger.',
          'apps/auth, services/ledger',
          'LedgerX, WalletCore',
          'npm test, npm run build',
        ].join('\n') + '\n',
      );
    });

    const result = JSON.parse(stdout) as {
      documents: Array<{ label: string; path: string }>;
    };
    const doc = await readFile(join(root, 'docs', 'base-context', 'domain-policy-guardrails.md'), 'utf8');
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const profile = await readProjectProfile(root);

    assert.ok(result.documents.length >= 4);
    assert.match(doc, /auth/i);
    assert.match(index, /Domain and Policy Guardrails -> docs\/base-context\/domain-policy-guardrails.md/);
    assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
    assert.equal(profile?.engineering_defaults.long_task_execution, 'tmux');
    assert.equal(profile?.onboarding_context?.policy_areas[0], 'auth');
    assert.equal(profile?.onboarding_context?.risky_domains[1], 'permissions');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax-onboard-context --input can persist shell language and platform settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-cli-settings-'));

  try {
    const onboardingPath = join(root, 'onboarding.json');
    await writeFile(
      onboardingPath,
      JSON.stringify(
        {
          documents: [
            {
              label: 'Business Context',
              content: '# Business Context\n\nCodex in-shell onboarding save fixture.\n',
            },
          ],
          onboardingContext: {
            business_context: 'Codex in-shell onboarding save fixture.',
            policy_areas: ['auth'],
            architecture_summary: 'API and worker split.',
            risky_domains: ['permissions'],
          },
          engineeringDefaults: {
            test_strategy: 'tdd',
            architecture: 'clean-boundaries',
            short_task_execution: 'subagent',
            long_task_execution: 'tmux',
            verification_commands: ['npm test', 'npm run build'],
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax-onboard-context.ts',
          '--root',
          root,
          '--input',
          onboardingPath,
          '--lang',
          'ko',
          '--platform',
          'codex',
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
        else reject(new Error(error || `ax-onboard-context exited ${code}`));
      });
    });

    const settings = await import('../core/settings/project-settings.js').then(({ readProjectSettings }) =>
      readProjectSettings(root),
    );
    assert.equal(settings?.locale, 'ko');
    assert.equal(settings?.preferred_platform, 'codex');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
