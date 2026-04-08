import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import {
  readWorkflowState,
  resumeRequestPipeline,
  startRequestPipeline,
} from '../core/planning/request-pipeline.js';
import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import { topicArtifactPath } from '../core/topics/topic-artifacts.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-pipeline-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

function reviewableSpec(): string {
  return [
    '# Topic Spec',
    '',
    '## Goal',
    '',
    'Implement auth refresh token rotation.',
    '',
    '## Relevant Context',
    '',
    '- Auth policy',
    '',
  ].join('\n');
}

function reviewablePlan(): string {
  return [
    '# Implementation Plan',
    '',
    'Use TDD first.',
    'Keep files small and respect architecture boundaries.',
    'Add tests for auth refresh rotation behavior.',
    '',
  ].join('\n');
}

test('startRequestPipeline bootstraps worktree, resolves context, and pauses for plan review', async () => {
  const repoRoot = await createGitRepo();

  try {
    await onboardProjectContext({
      rootDir: repoRoot,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
      ],
    });

    const result = await startRequestPipeline({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Need a reviewed auth-refresh delivery flow.',
      brainstormContent: '# Brainstorm\n\nClarified auth refresh rotation.\n',
      specContent: reviewableSpec(),
      implementationPlanContent: reviewablePlan(),
      baseBranch: 'main',
    });

    const resolved = JSON.parse(
      await readFile(topicArtifactPath(result.topicDir, 'resolved_context'), 'utf8'),
    ) as { matches: Array<{ label: string }> };
    const workflow = await readWorkflowState(result.topicDir);

    assert.equal(workflow.phase, 'awaiting_plan_review');
    assert.equal(resolved.matches[0]?.label, 'Auth policy');
    assert.equal(existsSync(result.worktree.worktree_path), true);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('resumeRequestPipeline round-trips from approval to commit_ready when artifacts are reviewable', async () => {
  const repoRoot = await createGitRepo();

  try {
    await onboardProjectContext({
      rootDir: repoRoot,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
      ],
    });

    const started = await startRequestPipeline({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Need a reviewed auth-refresh delivery flow.',
      brainstormContent: '# Brainstorm\n\nClarified auth refresh rotation.\n',
      specContent: reviewableSpec(),
      implementationPlanContent: reviewablePlan(),
      baseBranch: 'main',
    });

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Approved for implementation.',
    });
    await writeFile(join(started.worktree.worktree_path, 'feature.txt'), 'done\n', 'utf8');
    await writeFile(
      join(started.worktree.worktree_path, 'auth-refresh.test.ts'),
      [
        "import { test } from 'node:test';",
        "test('auth refresh keeps users signed in without schema changes', () => {});",
        '// Covers auth policy token rotation behavior',
        '',
      ].join('\n'),
      'utf8',
    );

    const resumed = await resumeRequestPipeline({
      topicDir: started.topicDir,
      verificationCommands: ['echo test'],
    });
    const workflow = await readWorkflowState(started.topicDir);
    const commitMessage = await readFile(
      topicArtifactPath(started.topicDir, 'commit_message'),
      'utf8',
    );

    assert.equal(resumed.aggregate.commit_allowed, true);
    assert.equal(workflow.phase, 'commit_ready');
    assert.match(commitMessage, /Constraint:/);
    assert.match(commitMessage, /Tested:/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('resumeRequestPipeline records mandatory escalation triggers and blocks until cleared', async () => {
  const repoRoot = await createGitRepo();

  try {
    await onboardProjectContext({
      rootDir: repoRoot,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
      ],
    });

    const started = await startRequestPipeline({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Need a reviewed auth-refresh delivery flow.',
      brainstormContent: '# Brainstorm\n\nClarified auth refresh rotation.\n',
      specContent: reviewableSpec(),
      implementationPlanContent: reviewablePlan(),
      baseBranch: 'main',
    });

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Approved for implementation.',
    });

    await assert.rejects(
      resumeRequestPipeline({
        topicDir: started.topicDir,
        escalationTriggers: [
          {
            kind: 'policy-conflict',
            summary: 'The reviewed implementation would violate the auth policy as written.',
          },
        ],
      }),
      /human escalation review/i,
    );

    const blocked = await readWorkflowState(started.topicDir);
    assert.equal(blocked.phase, 'awaiting_human_escalation');
    assert.equal(blocked.escalation?.status, 'required');
    assert.equal(blocked.escalation?.triggers[0]?.kind, 'policy-conflict');

    await writeFile(join(started.worktree.worktree_path, 'feature.txt'), 'done\n', 'utf8');
    await writeFile(
      join(started.worktree.worktree_path, 'auth-refresh.test.ts'),
      [
        "import { test } from 'node:test';",
        "test('auth refresh keeps users signed in without schema changes', () => {});",
        '// Covers auth policy token rotation behavior',
        '',
      ].join('\n'),
      'utf8',
    );

    const resumed = await resumeRequestPipeline({
      topicDir: started.topicDir,
      clearEscalations: true,
      escalationResolution: 'Human reviewer accepted the policy change after follow-up.',
      verificationCommands: ['echo test'],
    });
    const workflow = await readWorkflowState(started.topicDir);

    assert.equal(resumed.aggregate.commit_allowed, true);
    assert.equal(workflow.phase, 'commit_ready');
    assert.equal(workflow.escalation?.status, 'clear');
    assert.ok(workflow.escalation?.triggers[0]?.resolved_at);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
