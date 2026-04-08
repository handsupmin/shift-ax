import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import { runReviewLanes } from '../core/review/run-lanes.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-review-depth-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

async function writeReviewableTopic(root: string): Promise<{ topicDir: string; worktreePath: string }> {
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
  const worktreePath = join(root, '.ax', 'worktrees', '2026-04-08-auth-refresh');
  await mkdir(join(topicDir, 'review'), { recursive: true });
  await mkdir(join(topicDir, 'final'), { recursive: true });
  await mkdir(join(worktreePath, 'src'), { recursive: true });
  await mkdir(join(worktreePath, 'tests'), { recursive: true });

  const plan = [
    '# Implementation Plan',
    '',
    '1. Add auth refresh regression tests that cover token rotation and no-schema-change requirements.',
    '2. Update auth refresh service and token store using TDD.',
    '3. Keep billing and session UI out of scope.',
    '4. Route long-running migration analysis through tmux and short code slices through subagent execution.',
    '',
  ].join('\n');

  await writeFile(join(topicDir, 'request.md'), 'Build safer auth refresh flow\n', 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), 'Need a reviewed auth-refresh delivery flow.\n', 'utf8');
  await writeFile(
    join(topicDir, 'resolved-context.json'),
    JSON.stringify(
      {
        version: 1,
        request: 'Build safer auth refresh flow',
        matches: [{ label: 'Auth policy', path: 'docs/base-context/auth-policy.md' }],
        unresolved_paths: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'brainstorm.md'),
    [
      '# Brainstorm',
      '',
      '## Clarified Outcome',
      '',
      '- Users should stay signed in during refresh token rotation.',
      '',
      '## Constraints',
      '',
      '- Auth policy applies.',
      '- No schema changes.',
      '',
      '## Out of Scope',
      '',
      '- Billing flows.',
      '- Session UI changes.',
      '',
      '## Verification Expectations',
      '',
      '- Add auth refresh regression tests.',
      '- Run npm test and npm run build.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'spec.md'),
    [
      '# Topic Spec',
      '',
      '## Goal',
      '',
      'Users should stay signed in during refresh token rotation.',
      '',
      '## Constraints',
      '',
      '- Auth policy applies.',
      '- No schema changes.',
      '',
      '## Out of Scope',
      '',
      '- Billing flows.',
      '- Session UI changes.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(topicDir, 'implementation-plan.md'), plan, 'utf8');
  await writeFile(
    join(topicDir, 'plan-review.json'),
    JSON.stringify(
      {
        version: 1,
        status: 'approved',
        reviewer: 'Alex Reviewer',
        reviewed_at: new Date().toISOString(),
        approved_plan_fingerprint: {
          plan_path: 'implementation-plan.md',
          sha256: createHash('sha256').update(plan).digest('hex'),
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: '2026-04-08-auth-refresh',
        phase: 'review_pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_review_status: 'approved',
        worktree: {
          branch_name: 'ax/2026-04-08-auth-refresh',
          worktree_path: worktreePath,
          base_branch: 'main',
        },
        verification: [
          {
            command: 'npm test',
            exit_code: 0,
            stdout: 'all tests passed',
            stderr: '',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'worktree-state.json'),
    JSON.stringify(
      {
        version: 1,
        status: 'created',
        branch_name: 'ax/2026-04-08-auth-refresh',
        worktree_path: worktreePath,
        base_branch: 'main',
      },
      null,
      2,
    ),
    'utf8',
  );

  execFileSync('git', ['init', '--initial-branch=main'], { cwd: worktreePath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: worktreePath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: worktreePath, stdio: 'pipe' });
  await writeFile(join(worktreePath, 'README.md'), '# worktree\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: worktreePath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: worktreePath, stdio: 'pipe' });

  return { topicDir, worktreePath };
}

test('conversation-trace review fails when brainstorm details are not reflected in spec', async () => {
  const root = await createGitRepo();

  try {
    const { topicDir } = await writeReviewableTopic(root);
    await writeFile(
      join(topicDir, 'spec.md'),
      '# Topic Spec\n\n## Goal\n\nUsers should stay signed in during refresh token rotation.\n',
      'utf8',
    );

    const verdicts = await runReviewLanes({ topicDir });
    const byLane = new Map(verdicts.map((verdict) => [verdict.lane, verdict]));

    assert.equal(byLane.get('conversation-trace')?.status, 'changes_requested');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('test-adequacy review fails when changed code lacks aligned test evidence', async () => {
  const root = await createGitRepo();

  try {
    const { topicDir, worktreePath } = await writeReviewableTopic(root);
    await writeFile(join(worktreePath, 'src', 'auth-refresh.ts'), 'export const refresh = true;\n', 'utf8');
    execFileSync('git', ['add', 'src/auth-refresh.ts'], { cwd: worktreePath, stdio: 'pipe' });

    const verdicts = await runReviewLanes({ topicDir });
    const byLane = new Map(verdicts.map((verdict) => [verdict.lane, verdict]));

    assert.equal(byLane.get('test-adequacy')?.status, 'changes_requested');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('test-adequacy review approves when changed tests cover spec and policy language', async () => {
  const root = await createGitRepo();

  try {
    const { topicDir, worktreePath } = await writeReviewableTopic(root);
    await writeFile(join(worktreePath, 'src', 'auth-refresh.ts'), 'export const refresh = true;\n', 'utf8');
    await writeFile(
      join(worktreePath, 'tests', 'auth-refresh.test.ts'),
      [
        "import { test } from 'node:test';",
        "test('auth refresh keeps users signed in without schema changes', () => {});",
        '// Covers auth policy token rotation behavior',
        '',
      ].join('\n'),
      'utf8',
    );
    execFileSync('git', ['add', 'src/auth-refresh.ts', 'tests/auth-refresh.test.ts'], {
      cwd: worktreePath,
      stdio: 'pipe',
    });

    const verdicts = await runReviewLanes({ topicDir });
    const byLane = new Map(verdicts.map((verdict) => [verdict.lane, verdict]));

    assert.equal(byLane.get('test-adequacy')?.status, 'approved');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
