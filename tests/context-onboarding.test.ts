import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { readProjectProfile } from '../core/policies/project-profile.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('onboardProjectContext writes global docs, index, and profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-'));

  try {
    await withTempGlobalHome('shift-ax-onboarding-home-', async (home) => {
      const result = await onboardProjectContext({
        rootDir: root,
        primaryRoleSummary: 'I mainly build wallet APIs and ledger workflows.',
        workTypes: [
          {
            name: 'API development',
            summary: 'I add controllers, services, DTOs, and tests.',
            repositories: [
              {
                repository: 'wallet-api',
                repositoryPath: root,
                purpose: 'Wallet operations API',
                directories: ['src/controllers', 'src/services', 'src/dto'],
                workflow:
                  'Create controller/service/DTO changes together, then add request and service tests.',
                inferredNotes: ['Controller and service boundaries appear to exist.'],
                confirmationNotes: 'Confirmed by the user.',
                volatility: 'stable',
              },
            ],
          },
        ],
        domainLanguage: [
          {
            term: 'LedgerX',
            definition: 'Internal append-only ledger service.',
          },
        ],
        engineeringDefaults: {
          test_strategy: 'tdd',
          architecture: 'clean-boundaries',
          short_task_execution: 'subagent',
          long_task_execution: 'tmux',
        },
      });

      const workTypeDoc = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const procedureDoc = await readFile(join(home, 'procedures', 'api-development--wallet-api.md'), 'utf8');
      const roleDoc = await readFile(join(home, 'role', 'primary-role.md'), 'utf8');
      const glossaryDoc = await readFile(join(home, 'domain-language', 'ledgerx.md'), 'utf8');
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const profile = await readProjectProfile(root);

      assert.match(roleDoc, /## Summary/);
      assert.match(workTypeDoc, /wallet-api/);
      assert.match(procedureDoc, /## Summary/);
      assert.match(procedureDoc, /controller\/service\/DTO/i);
      assert.match(glossaryDoc, /## Summary/);
      assert.match(glossaryDoc, /append-only ledger service/i);
      assert.match(index, /single Shift AX dictionary/);
      assert.match(index, /## Role/);
      assert.match(index, /Primary Role -> role\/primary-role.md/);
      assert.match(index, /API development -> work-types\/api-development.md/);
      assert.match(index, /## Repositories/);
      assert.match(index, /wallet-api -> repos\/wallet-api.md/);
      assert.match(index, /## Procedures/);
      assert.match(index, /API development .+ wallet-api -> procedures\/api-development--wallet-api.md/);
      assert.match(index, /LedgerX -> domain-language\/ledgerx.md/);
      assert.equal(result.documents.length >= 3, true);
      assert.ok(profile);
      assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
      assert.equal(profile?.engineering_defaults.short_task_execution, 'subagent');
      assert.equal(profile?.context_docs.some((entry) => entry.path === 'work-types/api-development.md'), true);
      assert.equal(profile?.onboarding_context?.work_types[0], 'API development');
      assert.match(profile?.onboarding_context?.primary_role_summary ?? '', /wallet APIs/i);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('onboardProjectContext treats settings-only global home as not yet onboarded', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-settings-only-'));

  try {
    await withTempGlobalHome('shift-ax-onboarding-settings-only-home-', async (home) => {
      const settingsPath = join(home, 'settings.json');
      const settings = {
        version: 1,
        updated_at: '2026-05-17T00:00:00.000Z',
        locale: 'ko',
        preferred_language: 'korean',
        preferred_platform: 'codex',
      };
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

      await onboardProjectContext({
        rootDir: root,
        primaryRoleSummary: 'I mainly build request-to-commit workflows.',
        workTypes: [
          {
            name: 'Harness development',
            summary: 'I maintain request intake, planning, review, and commit gates.',
            repositories: [
              {
                repository: 'shift-ax',
                repositoryPath: root,
                purpose: 'Request-to-commit harness',
                directories: ['core/context', 'core/planning', 'core/review'],
                workflow: 'Capture context, review the plan, implement, verify, and commit.',
                inferredNotes: ['File-backed artifacts are required.'],
                confirmationNotes: 'Confirmed by the user.',
                volatility: 'stable',
              },
            ],
          },
        ],
        overwrite: false,
      });

      const index = await readFile(join(home, 'index.md'), 'utf8');
      const preservedSettings = JSON.parse(await readFile(settingsPath, 'utf8')) as typeof settings;

      assert.match(index, /Harness development -> work-types\/harness-development.md/);
      assert.deepEqual(preservedSettings, settings);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('onboardProjectContext infers mandatory repo review gates from merged PR history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-pr-gates-'));

  try {
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
    await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
    execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['checkout', '-b', 'feature/queue-worker'], { cwd: root, stdio: 'pipe' });
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'tests'), { recursive: true });
    await writeFile(join(root, 'src', 'queue-worker.service.ts'), 'export const worker = true;\n', 'utf8');
    await writeFile(join(root, 'tests', 'queue-worker.test.ts'), 'export const covered = true;\n', 'utf8');
    execFileSync('git', ['add', 'src/queue-worker.service.ts', 'tests/queue-worker.test.ts'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'Add queue worker service tests'], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['checkout', 'main'], { cwd: root, stdio: 'pipe' });
    execFileSync(
      'git',
      ['merge', '--no-ff', 'feature/queue-worker', '-m', 'Merge pull request #12 from team/feature/queue-worker'],
      { cwd: root, stdio: 'pipe' },
    );

    await withTempGlobalHome('shift-ax-onboarding-pr-gates-home-', async (home) => {
      const result = await onboardProjectContext({
        rootDir: root,
        primaryRoleSummary: 'I maintain worker APIs.',
        workTypes: [
          {
            name: 'Worker development',
            summary: 'Implement service, worker, queue, and tests together.',
            repositories: [
              {
                repository: 'worker-api',
                repositoryPath: root,
                purpose: 'Worker API',
                directories: ['src', 'tests'],
                workflow: 'Update service and worker queue code with tests, then run npm test.',
                hiddenConventions: ['Keep service and worker responsibilities separate.'],
              },
            ],
          },
        ],
      });

      const gate = result.profile.repository_review_gates?.[0];
      const procedureDoc = await readFile(
        join(home, 'procedures', 'worker-development--worker-api.md'),
        'utf8',
      );

      assert.ok(gate);
      assert.equal(gate.repository, 'worker-api');
      assert.match(gate.evidence.join('\n'), /Merge pull request #12/);
      assert.match(gate.architecture.join('\n'), /architecture|layer|merged PR/i);
      assert.match(gate.working_process.join('\n'), /verification|merged PR|npm test/i);
      assert.match(gate.conventions.join('\n'), /service and worker responsibilities/i);
      assert.match(gate.side_effects.join('\n'), /queue|worker|side/i);
      assert.match(procedureDoc, /Mandatory Repo Review Gate/);
      assert.match(procedureDoc, /### Architecture/);
      assert.match(procedureDoc, /### Working Process/);
      assert.match(procedureDoc, /### Conventions/);
      assert.match(procedureDoc, /### Side Effects/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
