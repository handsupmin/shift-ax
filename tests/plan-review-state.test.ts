import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { bootstrapTopic } from '../core/topics/bootstrap.js';
import { topicArtifactPath } from '../core/topics/topic-artifacts.js';
import {
  readWorkflowState,
} from '../core/planning/request-pipeline.js';
import {
  recordPlanReviewDecision,
  verifyApprovedPlanFingerprint,
} from '../core/planning/plan-review.js';

test('recordPlanReviewDecision writes approval fingerprint and detects stale plan changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-plan-review-'));

  try {
    const topic = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    await writeFile(
      topicArtifactPath(topic.topicDir, 'implementation_plan'),
      [
        '# Implementation Plan',
        '',
        'Use TDD first.',
        'Keep files small and respect architecture boundaries.',
        'Add tests for auth refresh rotation.',
        '',
      ].join('\n'),
      'utf8',
    );

    const approved = await recordPlanReviewDecision({
      topicDir: topic.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
      notes: 'Looks good.',
    });

    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewer, 'Alex Reviewer');
    assert.ok(approved.approved_plan_fingerprint?.sha256);

    const matched = await verifyApprovedPlanFingerprint({ topicDir: topic.topicDir });
    assert.equal(matched.matches, true);

    await writeFile(
      topicArtifactPath(topic.topicDir, 'implementation_plan'),
      '# Implementation Plan\n\nChanged after approval.\n',
      'utf8',
    );

    const stale = await verifyApprovedPlanFingerprint({ topicDir: topic.topicDir });
    assert.equal(stale.matches, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('changes-requested plan review keeps workflow in awaiting_plan_review', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-plan-review-reject-'));

  try {
    const topic = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    await writeFile(
      topicArtifactPath(topic.topicDir, 'implementation_plan'),
      '# Implementation Plan\n\nUse TDD first.\n',
      'utf8',
    );

    await recordPlanReviewDecision({
      topicDir: topic.topicDir,
      reviewer: 'Blake Reviewer',
      status: 'changes_requested',
      notes: 'Need tighter scope.',
    });

    const review = JSON.parse(
      await readFile(topicArtifactPath(topic.topicDir, 'plan_review'), 'utf8'),
    ) as { status: string; reviewer: string };
    const workflow = await readWorkflowState(topic.topicDir);

    assert.equal(review.status, 'changes_requested');
    assert.equal(review.reviewer, 'Blake Reviewer');
    assert.equal(workflow.phase, 'awaiting_plan_review');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
