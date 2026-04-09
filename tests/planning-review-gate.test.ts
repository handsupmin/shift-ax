import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import { startRequestPipeline } from '../core/planning/request-pipeline.js';
import { aggregateReviewVerdicts } from '../core/review/aggregate-reviews.js';
import { runReviewLanes } from '../core/review/run-lanes.js';
import { seedSampleOnboarding } from './helpers/sample-onboarding.js';
import { withTempGlobalHome } from './helpers/global-home.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-plan-gate-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('review lanes block commit when human plan review has not approved the plan', async () => {
  const repoRoot = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-review-gate-home-', async () => {
      await seedSampleOnboarding(repoRoot);

      const started = await startRequestPipeline({
        rootDir: repoRoot,
        request: 'Build safer auth refresh flow',
        summary: 'Need a reviewed auth-refresh delivery flow.',
        brainstormContent: '# Brainstorm\n\nClarified auth refresh rotation.\n',
        specContent: '# Topic Spec\n\n## Goal\n\nImplement auth refresh token rotation.\n',
        implementationPlanContent: '# Implementation Plan\n\nUse TDD first.\nKeep files small and respect architecture boundaries.\n',
        baseBranch: 'main',
      });

      const verdicts = await runReviewLanes({ topicDir: started.topicDir });
      const aggregate = await aggregateReviewVerdicts({ topicDir: started.topicDir });
      const byLane = new Map(verdicts.map((verdict) => [verdict.lane, verdict]));

      assert.equal(byLane.get('spec-conformance')?.status, 'changes_requested');
      assert.match(byLane.get('spec-conformance')?.summary ?? '', /plan review/i);
      assert.equal(aggregate.commit_allowed, false);

      await recordPlanReviewDecision({
        topicDir: started.topicDir,
        reviewer: 'Alex Reviewer',
        status: 'approved',
        notes: 'Approved for implementation.',
      });

      const approvedVerdicts = await runReviewLanes({ topicDir: started.topicDir });
      const approvedByLane = new Map(
        approvedVerdicts.map((verdict) => [verdict.lane, verdict]),
      );

      assert.equal(approvedByLane.get('spec-conformance')?.status, 'approved');
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
