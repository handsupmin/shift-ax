import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import {
  completePolicyContextSync,
  readPolicyContextSyncArtifact,
} from '../core/planning/policy-context-sync.js';
import {
  readWorkflowState,
  resumeRequestPipeline,
  startRequestPipeline,
} from '../core/planning/request-pipeline.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-policy-sync-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

function reviewablePlanWithPolicyUpdate(): string {
  return [
    '# Implementation Plan',
    '',
    '## Delivery Tasks',
    '',
    '1. Add or update tests first.',
    '2. Implement the auth refresh change.',
    '',
    '## Base-Context Policy Updates',
    '',
    '- Update Auth policy to document the new refresh-token revocation rule.',
    '',
  ].join('\n');
}

test('approved plans that require base-context policy updates block implementation until synced', async () => {
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
      brainstormContent: [
        '# Brainstorm',
        '',
        '## Request',
        '',
        'Build safer auth refresh flow',
        '',
        '## Base-Context Policy Updates',
        '',
        '- Update Auth policy to explain the new refresh-token revocation rule.',
        '',
      ].join('\n'),
      specContent: [
        '# Topic Spec',
        '',
        '## Goal',
        '',
        'Implement auth refresh token rotation.',
        '',
        '## Base-Context Policy Updates',
        '',
        '- Update Auth policy to explain the new refresh-token revocation rule.',
        '',
      ].join('\n'),
      implementationPlanContent: reviewablePlanWithPolicyUpdate(),
      baseBranch: 'main',
    });

    const syncArtifact = await readPolicyContextSyncArtifact(started.topicDir);
    assert.equal(syncArtifact.status, 'required');
    assert.match(syncArtifact.required_updates[0] ?? '', /Auth policy/i);

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Approved once shared policy docs are updated first.',
    });

    const blockedWorkflow = await readWorkflowState(started.topicDir);
    assert.equal(blockedWorkflow.phase, 'awaiting_policy_sync');

    await assert.rejects(
      resumeRequestPipeline({
        topicDir: started.topicDir,
        verificationCommands: ['echo test'],
      }),
      /policy context sync|policy sync/i,
    );

    await writeFile(
      join(repoRoot, 'docs', 'base-context', 'auth-policy.md'),
      '# Auth Policy\n\nRefresh token rotation is required.\n\nRevocation events must clear the old refresh token.\n',
      'utf8',
    );

    const completed = await completePolicyContextSync({
      topicDir: started.topicDir,
      summary: 'Updated the shared auth policy before implementation.',
      syncedPaths: ['docs/base-context/auth-policy.md'],
    });

    assert.equal(completed.status, 'completed');

    const resumed = await resumeRequestPipeline({
      topicDir: started.topicDir,
      verificationCommands: ['echo test'],
      executionRunner: async () => ({
        version: 1,
        overall_status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        tasks: [],
      }),
    });

    assert.equal(resumed.aggregate.commit_allowed, false);
    const workflow = await readWorkflowState(started.topicDir);
    assert.equal(workflow.phase, 'implementation_running');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
