import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { topicArtifactPath } from '../core/topics/topic-artifacts.js';

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

async function runAx(args: string[], input = ''): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', ...args],
      {
        cwd: '/Users/sangmin/sources/shift-ax',
        stdio: ['pipe', 'pipe', 'pipe'],
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

test('CLI happy path covers onboard -> run-request -> approve-plan -> resume with automatic commit', async () => {
  const root = await createGitRepo();

  try {
    const onboardingPath = join(root, 'onboarding.json');
    await writeFile(
      onboardingPath,
      JSON.stringify(
        {
          documents: [
            {
              label: 'Auth policy',
              content: '# Auth Policy\n\nRefresh token rotation is required.\n',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const onboarded = await runAx(['onboard-context', '--root', root, '--input', onboardingPath]);
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
    ]);
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

    const resumed = await runAx([
      'run-request',
      '--topic',
      startResult.topicDir,
      '--resume',
      '--verify-command',
      'echo test',
    ]);
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI escalation path blocks resume until a human clears the stop', async () => {
  const root = await createGitRepo();

  try {
    const onboardingPath = join(root, 'onboarding.json');
    await writeFile(
      onboardingPath,
      JSON.stringify(
        {
          documents: [
            {
              label: 'Auth policy',
              content: '# Auth Policy\n\nRefresh token rotation is required.\n',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    assert.equal(
      (await runAx(['onboard-context', '--root', root, '--input', onboardingPath])).code,
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
    ]);
    assert.equal(approved.code, 0, approved.stderr);

    const escalated = await runAx([
      'run-request',
      '--topic',
      startResult.topicDir,
      '--resume',
      '--escalation',
      'policy-conflict:Auth policy conflicts with the proposed flow',
    ]);
    assert.equal(escalated.code, 1);
    assert.match(escalated.stderr, /human escalation review/i);

    const blockedResume = await runAx([
      'run-request',
      '--topic',
      startResult.topicDir,
      '--resume',
    ]);
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
    ]);
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
