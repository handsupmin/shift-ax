import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { topicArtifactPath } from '../core/topics/topic-artifacts.js';
import { writeProjectSettings } from '../core/settings/project-settings.js';
import { withTempGlobalHome } from './helpers/global-home.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-cli-flow-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

async function runAx(args: string[], input = '', env?: NodeJS.ProcessEnv): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', ...args],
      {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
    child.stdin.end(input);
  });
}

function onboardingFixture(root: string) {
  return {
    primaryRoleSummary: 'I maintain auth APIs.',
    workTypes: [
      {
        name: 'API development',
        repositories: [
          {
            repository: 'sample-repo',
            repositoryPath: root,
            purpose: 'Fixture repo',
            directories: ['src', 'tests'],
            workflow: 'Update auth code and tests together.',
          },
        ],
      },
    ],
    domainLanguage: [{ term: 'Auth policy', definition: 'Fixture auth policy term.' }],
  };
}

async function writeExecutionArtifacts({
  topicDir,
  changedFiles,
  summary,
}: {
  topicDir: string;
  changedFiles: string[];
  summary: string;
}): Promise<void> {
  await mkdir(join(topicDir, 'execution-results'), { recursive: true });
  const outputPath = join(topicDir, 'execution-results', 'task-1.json');
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        changed_files: changedFiles,
        summary,
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'execution-state.json'),
    JSON.stringify(
      {
        version: 1,
        overall_status: 'completed',
        tasks: [
          {
            task_id: 'task-1',
            execution_mode: 'subagent',
            status: 'completed',
            output_path: outputPath,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('CLI happy path covers onboard -> run-request -> approve-plan -> resume with automatic commit', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-request-cli-home-', async (home) => {
      const onboardingPath = join(root, 'onboarding.json');
      await writeFile(onboardingPath, JSON.stringify(onboardingFixture(root), null, 2), 'utf8');
      const env = { ...process.env, SHIFT_AX_HOME: home };

      const onboarded = await runAx(['onboard-context', '--root', root, '--input', onboardingPath], '', env);
      assert.equal(onboarded.code, 0, onboarded.stderr);

      const started = await runAx(
        [
          'run-request',
          '--root',
          root,
          '--request',
          'Build safer auth refresh flow',
        ],
        [
          'Users should stay signed in during refresh token rotation.',
          'Auth policy applies and no schema changes are allowed.',
          'Do not change billing or the session UI.',
          'Verification needs auth refresh tests plus a clean build.',
          'Auth refresh service, token store, and session middleware.',
          'Token store migration analysis is the only long-running slice.',
          '',
        ].join('\n'),
        env,
      );
      assert.equal(started.code, 0, started.stderr);

      const startResult = JSON.parse(started.stdout) as {
        topicDir: string;
        workflow: { phase: string };
        worktree: { worktree_path: string };
      };
      assert.equal(startResult.workflow.phase, 'awaiting_plan_review');

      const approved = await runAx([
        'approve-plan',
        '--topic',
        startResult.topicDir,
        '--reviewer',
        'Alex Reviewer',
        '--decision',
        'approve',
      ], '', env);
      assert.equal(approved.code, 0, approved.stderr);

      await writeFile(join(startResult.worktree.worktree_path, 'feature.txt'), 'done\n', 'utf8');
      await writeFile(
        join(startResult.worktree.worktree_path, 'auth-refresh.test.ts'),
        [
          "import { test } from 'node:test';",
          "test('auth refresh keeps users signed in without schema changes', () => {});",
          '// Covers auth policy token rotation behavior',
          '',
        ].join('\n'),
        'utf8',
      );
      await writeExecutionArtifacts({
        topicDir: startResult.topicDir,
        changedFiles: ['feature.txt', 'auth-refresh.test.ts'],
        summary:
          'Updated feature.txt and auth-refresh.test.ts for the auth policy token rotation flow.',
      });

      const resumed = await runAx([
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
        '--verify-command',
        'echo test',
      ], '', env);
      assert.equal(resumed.code, 0, resumed.stderr);

      const resumedResult = JSON.parse(resumed.stdout) as {
        workflow: { phase: string };
        aggregate: { commit_allowed: boolean };
        finalization?: { commit_sha: string };
      };
      assert.equal(resumedResult.workflow.phase, 'committed');
      assert.equal(resumedResult.aggregate.commit_allowed, true);
      assert.ok(resumedResult.finalization?.commit_sha);

      const commitMessage = await readFile(
        topicArtifactPath(startResult.topicDir, 'commit_message'),
        'utf8',
      );
      assert.match(commitMessage, /Constraint:/);
      assert.match(commitMessage, /Tested:/);

      const head = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: startResult.worktree.worktree_path,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      const workflowState = JSON.parse(
        await readFile(topicArtifactPath(startResult.topicDir, 'workflow_state'), 'utf8'),
      ) as { phase: string };

      assert.equal(resumedResult.finalization?.commit_sha, head);
      assert.equal(workflowState.phase, 'committed');
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI automatic commit uses the saved locale for generated commit messages', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-request-cli-home-', async (home) => {
      const onboardingPath = join(root, 'onboarding.json');
      await writeFile(onboardingPath, JSON.stringify(onboardingFixture(root), null, 2), 'utf8');
      const env = { ...process.env, SHIFT_AX_HOME: home };

      const onboarded = await runAx(['onboard-context', '--root', root, '--input', onboardingPath], '', env);
      assert.equal(onboarded.code, 0, onboarded.stderr);

      await writeProjectSettings({
        rootDir: root,
        settings: {
          version: 1,
          updated_at: new Date().toISOString(),
          locale: 'ko',
          preferred_language: 'korean',
          preferred_platform: 'codex',
        },
      });

      const started = await runAx(
        [
          'run-request',
          '--root',
          root,
          '--request',
          'Build safer auth refresh flow',
        ],
        [
          'Users should stay signed in during refresh token rotation.',
          'Auth policy applies and no schema changes are allowed.',
          'Do not change billing or the session UI.',
          'Verification needs auth refresh tests plus a clean build.',
          'Auth refresh service, token store, and session middleware.',
          'Token store migration analysis is the only long-running slice.',
          '',
        ].join('\n'),
        env,
      );
      assert.equal(started.code, 0, started.stderr);

      const startResult = JSON.parse(started.stdout) as {
        topicDir: string;
        worktree: { worktree_path: string };
      };

      const approved = await runAx([
        'approve-plan',
        '--topic',
        startResult.topicDir,
        '--reviewer',
        'Alex Reviewer',
        '--decision',
        'approve',
      ], '', env);
      assert.equal(approved.code, 0, approved.stderr);

      await writeFile(join(startResult.worktree.worktree_path, 'feature.txt'), 'done\n', 'utf8');
      await writeFile(
        join(startResult.worktree.worktree_path, 'auth-refresh.test.ts'),
        [
          "import { test } from 'node:test';",
          "test('auth refresh keeps users signed in without schema changes', () => {});",
          '// Covers auth policy token rotation behavior',
          '',
        ].join('\n'),
        'utf8',
      );
      await writeExecutionArtifacts({
        topicDir: startResult.topicDir,
        changedFiles: ['feature.txt', 'auth-refresh.test.ts'],
        summary:
          'Updated feature.txt and auth-refresh.test.ts for the auth policy token rotation flow.',
      });

      const resumed = await runAx([
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
        '--verify-command',
        'echo test',
      ], '', env);
      assert.equal(resumed.code, 0, resumed.stderr);

      const commitMessage = await readFile(
        topicArtifactPath(startResult.topicDir, 'commit_message'),
        'utf8',
      );
      const gitLog = execFileSync('git', ['log', '-1', '--pretty=%B'], {
        cwd: startResult.worktree.worktree_path,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      assert.match(commitMessage, /검토된 변경 반영:/);
      assert.match(commitMessage, /검토된 Shift AX 작업을 반영합니다/);
      assert.match(gitLog, /검토된 변경 반영:/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI escalation path blocks resume until a human clears the stop', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-request-cli-home-', async (home) => {
      const onboardingPath = join(root, 'onboarding.json');
      await writeFile(onboardingPath, JSON.stringify(onboardingFixture(root), null, 2), 'utf8');
      const env = { ...process.env, SHIFT_AX_HOME: home };

      assert.equal(
        (await runAx(['onboard-context', '--root', root, '--input', onboardingPath], '', env)).code,
        0,
      );

      const started = await runAx(
        [
          'run-request',
          '--root',
          root,
          '--request',
          'Build safer auth refresh flow',
        ],
        [
          'Users should stay signed in during refresh token rotation.',
          'Auth policy applies and no schema changes are allowed.',
          'Do not change billing or the session UI.',
          'Verification needs auth refresh tests plus a clean build.',
          'Auth refresh service, token store, and session middleware.',
          'Token store migration analysis is the only long-running slice.',
          '',
        ].join('\n'),
        env,
      );
      assert.equal(started.code, 0, started.stderr);
      const startResult = JSON.parse(started.stdout) as {
        topicDir: string;
        worktree: { worktree_path: string };
      };

      const approved = await runAx([
        'approve-plan',
        '--topic',
        startResult.topicDir,
        '--reviewer',
        'Alex Reviewer',
        '--decision',
        'approve',
      ], '', env);
      assert.equal(approved.code, 0, approved.stderr);

      const escalated = await runAx([
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
        '--escalation',
        'policy-conflict:Auth policy conflicts with the proposed flow',
      ], '', env);
      assert.equal(escalated.code, 1);
      assert.match(escalated.stderr, /human escalation review/i);

      const blockedResume = await runAx([
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
      ], '', env);
      assert.equal(blockedResume.code, 1);
      assert.match(blockedResume.stderr, /active escalation triggers/i);

      await writeFile(join(startResult.worktree.worktree_path, 'feature.txt'), 'done\n', 'utf8');
      await writeFile(
        join(startResult.worktree.worktree_path, 'auth-refresh.test.ts'),
        [
          "import { test } from 'node:test';",
          "test('auth refresh keeps users signed in without schema changes', () => {});",
          '// Covers auth policy token rotation behavior',
          '',
        ].join('\n'),
        'utf8',
      );
      await writeExecutionArtifacts({
        topicDir: startResult.topicDir,
        changedFiles: ['feature.txt', 'auth-refresh.test.ts'],
        summary:
          'Updated feature.txt and auth-refresh.test.ts for the auth policy token rotation flow.',
      });

      const cleared = await runAx([
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
        '--clear-escalations',
        '--escalation-resolution',
        'Reviewer approved the updated approach',
        '--verify-command',
        'echo test',
      ], '', env);
      assert.equal(cleared.code, 0, cleared.stderr);

      const clearedResult = JSON.parse(cleared.stdout) as {
        workflow: {
          phase: string;
          escalation?: {
            status: string;
            triggers: Array<{ resolved_at?: string }>;
          };
        };
        aggregate: { commit_allowed: boolean };
      };

      assert.equal(clearedResult.aggregate.commit_allowed, true);
      assert.equal(clearedResult.workflow.phase, 'committed');
      assert.equal(clearedResult.workflow.escalation?.status, 'clear');
      assert.ok(clearedResult.workflow.escalation?.triggers[0]?.resolved_at);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
