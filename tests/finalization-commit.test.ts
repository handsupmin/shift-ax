import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { buildLoreCommitMessage } from '../core/finalization/commit-message.js';
import { finalizeTopicCommit } from '../core/finalization/commit-workflow.js';
import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import { resumeRequestPipeline, startRequestPipeline } from '../core/planning/request-pipeline.js';
import { topicArtifactPath } from '../core/topics/topic-artifacts.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-finalize-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('finalizeTopicCommit creates a local git commit and records the sha', async () => {
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
      specContent: '# Topic Spec\n\n## Goal\n\nImplement auth refresh token rotation.\n',
      implementationPlanContent:
        '# Implementation Plan\n\nUse TDD first.\nKeep files small and respect architecture boundaries.\n',
      baseBranch: 'main',
    });

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Approved for implementation.',
    });

    await mkdir(join(started.worktree.worktree_path, 'src'), { recursive: true });
    await writeFile(
      join(started.worktree.worktree_path, 'src', 'feature.txt'),
      'auth refresh done\n',
      'utf8',
    );

    await resumeRequestPipeline({ topicDir: started.topicDir });

    const result = await finalizeTopicCommit({ topicDir: started.topicDir });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: started.worktree.worktree_path,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    const log = execFileSync('git', ['log', '-1', '--pretty=%B'], {
      cwd: started.worktree.worktree_path,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const state = JSON.parse(
      await readFile(topicArtifactPath(started.topicDir, 'commit_state'), 'utf8'),
    ) as { commit_sha: string; status: string };
    const storedCommitMessage = await readFile(
      topicArtifactPath(started.topicDir, 'commit_message'),
      'utf8',
    );

    assert.equal(result.commit_sha, head);
    assert.equal(state.commit_sha, head);
    assert.equal(state.status, 'committed');
    assert.match(log, /Deliver reviewed change:/);
    assert.match(storedCommitMessage, /Constraint:/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizeTopicCommit persists explicit commit messages before committing', async () => {
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
      specContent: '# Topic Spec\n\n## Goal\n\nImplement auth refresh token rotation.\n',
      implementationPlanContent:
        '# Implementation Plan\n\nUse TDD first.\nKeep files small and respect architecture boundaries.\n',
      baseBranch: 'main',
    });

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Approved for implementation.',
    });

    await mkdir(join(started.worktree.worktree_path, 'src'), { recursive: true });
    await writeFile(
      join(started.worktree.worktree_path, 'src', 'feature.txt'),
      'auth refresh done\n',
      'utf8',
    );

    await resumeRequestPipeline({ topicDir: started.topicDir });

    const explicitMessage = buildLoreCommitMessage({
      intent: 'Keep explicit finalization messages authoritative',
      body: 'This commit verifies that explicit commit message overrides are persisted before git commit runs.',
      constraint: 'finalization must commit the message selected by the operator',
      confidence: 'high',
      scopeRisk: 'narrow',
      directive: 'Do not ignore the explicit commit message input path during finalization',
      tested: 'finalizeTopicCommit explicit-message fixture',
      notTested: 'GitHub push or PR integration',
    });

    await finalizeTopicCommit({
      topicDir: started.topicDir,
      message: explicitMessage,
    });

    const log = execFileSync('git', ['log', '-1', '--pretty=%B'], {
      cwd: started.worktree.worktree_path,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const stored = await readFile(topicArtifactPath(started.topicDir, 'commit_message'), 'utf8');

    assert.match(log, /Keep explicit finalization messages authoritative/);
    assert.equal(stored, `${explicitMessage.trimEnd()}\n`);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizeTopicCommit refuses when aggregate review does not allow commit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-finalize-blocked-'));

  try {
    await mkdir(join(root, '.ax', 'topics', '2026-04-07-blocked', 'review'), {
      recursive: true,
    });
    await mkdir(join(root, '.ax', 'topics', '2026-04-07-blocked', 'final'), {
      recursive: true,
    });
    await writeFile(
      join(root, '.ax', 'topics', '2026-04-07-blocked', 'review', 'aggregate.json'),
      JSON.stringify(
        {
          version: 1,
          overall_status: 'changes_requested',
          commit_allowed: false,
          next_stage: 'implementation',
          required_lanes: [],
          approved_lanes: [],
          changes_requested_lanes: ['spec-conformance'],
          blocked_lanes: [],
          missing_lanes: [],
          verdicts: [],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(root, '.ax', 'topics', '2026-04-07-blocked', 'final', 'commit-message.md'),
      buildLoreCommitMessage({
        intent: 'Blocked commit should never run',
        body: 'This message exists only for the blocked finalization test.',
        constraint: 'review gate must pass before committing',
        confidence: 'high',
        scopeRisk: 'narrow',
        directive: 'Do not bypass aggregate review',
        tested: 'blocked fixture',
        notTested: 'git commit execution',
      }),
      'utf8',
    );

    await assert.rejects(
      finalizeTopicCommit({ topicDir: join(root, '.ax', 'topics', '2026-04-07-blocked') }),
      /commit_allowed/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
