import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { readProjectProfile } from '../core/policies/project-profile.js';
import { withTempGlobalHome } from './helpers/global-home.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax-onboard-context prompts interactively when no input file is provided', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-cli-'));

  try {
    await withTempGlobalHome('shift-ax-onboarding-cli-home-', async (home) => {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax-onboard-context.ts', '--root', root],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              SHIFT_AX_HOME: home,
            },
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
            '',
            'I build wallet APIs and auth flows.',
            'API development, incident response',
            'Create controller, service, dto, tests together.',
            'wallet-api',
            '',
            'Wallet operations API',
            'src/controllers, src/services, src/dto',
            'Looks right except Prisma migrations are handled elsewhere.',
            'For API work I usually add controller/service/DTO changes and request tests first.',
            'Triage alerts and patch risky endpoints quickly.',
            'wallet-api',
            '',
            'Wallet operations API',
            'src/controllers, src/services',
            'Looks mostly right.',
            'For incidents I inspect impacted controllers/services, patch, then run focused regression checks.',
            'LedgerX, WalletCore',
            'Internal append-only ledger service.',
            'Core wallet bounded context.',
            'npm test, npm run build',
            '',
          ].join('\n') + '\n',
        );
      });

      const result = JSON.parse(stdout) as {
        documents: Array<{ label: string; path: string }>;
      };
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const workTypeDoc = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const profile = await readProjectProfile(root);

      assert.ok(result.documents.length >= 4);
      assert.match(workTypeDoc, /wallet-api/i);
      assert.match(index, /API development -> work-types\/api-development.md/);
      assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
      assert.equal(profile?.engineering_defaults.long_task_execution, 'tmux');
      assert.equal(profile?.onboarding_context?.work_types[0], 'API development');
      assert.equal(profile?.onboarding_context?.domain_language[1], 'WalletCore');
    });
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
          primaryRoleSummary: 'Codex in-shell onboarding save fixture.',
          workTypes: [
            {
              name: 'API development',
              summary: 'Build APIs and worker hooks.',
              repositories: [
                {
                  repository: 'codex-shell',
                  repositoryPath: root,
                  purpose: 'Shell fixture repo',
                  directories: ['src/api'],
                  workflow: 'Update API boundary files and tests together.',
                },
              ],
            },
          ],
          domainLanguage: [
            {
              term: 'CodexShell',
              definition: 'Fixture term for shell onboarding.',
            },
          ],
          onboardingContext: {
            primary_role_summary: 'Codex in-shell onboarding save fixture.',
            work_types: ['API development'],
            domain_language: ['CodexShell'],
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

    await withTempGlobalHome('shift-ax-onboarding-cli-settings-home-', async (home) => {
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

      const settings = await import('../core/settings/project-settings.js').then(({ readProjectSettings }) =>
        readProjectSettings(root),
      );
      assert.equal(settings?.locale, 'ko');
      assert.equal(settings?.preferred_platform, 'codex');
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
