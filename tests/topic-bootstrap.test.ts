import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { bootstrapTopic, slugifyTopic } from '../core/topics/bootstrap.js';

test('slugifyTopic creates a stable lowercase slug', () => {
  assert.equal(
    slugifyTopic('Build Auth Refresh Flow v2'),
    'build-auth-refresh-flow-v2',
  );
});

test('bootstrapTopic creates topic artifacts from the initial request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-'));

  try {
    const result = await bootstrapTopic({
      rootDir: root,
      request:
        'Build a safer auth refresh flow and ensure policy-aware review before commit.',
      summary:
        'Need a new auth-refresh delivery topic with planning and review artifacts.',
    });

    assert.match(
      result.topicSlug,
      /^\d{4}-\d{2}-\d{2}-build-a-safer-auth-refresh-flow/,
    );
    assert.ok(result.topicDir.endsWith(result.topicSlug));

    const request = await readFile(join(result.topicDir, 'request.md'), 'utf8');
    const summary = await readFile(join(result.topicDir, 'request-summary.md'), 'utf8');
    const metadata = JSON.parse(
      await readFile(join(result.topicDir, 'topic.json'), 'utf8'),
    ) as {
      topic_slug: string;
      status: string;
      artifacts: Record<string, string>;
    };

    assert.match(request, /Build a safer auth refresh flow/);
    assert.match(summary, /auth-refresh delivery topic/);
    assert.equal(metadata.topic_slug, result.topicSlug);
    assert.equal(metadata.status, 'bootstrapped');
    assert.equal(metadata.artifacts.request, 'request.md');
    assert.equal(metadata.artifacts.request_summary, 'request-summary.md');
    assert.equal(metadata.artifacts.resolved_context, 'resolved-context.json');
    assert.equal(metadata.artifacts.brainstorm, 'brainstorm.md');
    assert.equal(metadata.artifacts.spec, 'spec.md');
    assert.equal(metadata.artifacts.plan_review, 'plan-review.json');
    assert.equal(metadata.artifacts.implementation_plan, 'implementation-plan.md');
    assert.equal(metadata.artifacts.execution_handoff, 'execution-handoff.json');
    assert.equal(metadata.artifacts.workflow_state, 'workflow-state.json');
    assert.equal(metadata.artifacts.review_dir, 'review');
    assert.equal(metadata.artifacts.final_dir, 'final');
    assert.equal(metadata.artifacts.commit_message, 'final/commit-message.md');
    assert.equal(metadata.artifacts.commit_state, 'final/commit-state.json');

    const reviewDir = await stat(join(result.topicDir, 'review'));
    const finalDir = await stat(join(result.topicDir, 'final'));
    const brainstorm = await readFile(join(result.topicDir, 'brainstorm.md'), 'utf8');
    const spec = await readFile(join(result.topicDir, 'spec.md'), 'utf8');
    const implementationPlan = await readFile(
      join(result.topicDir, 'implementation-plan.md'),
      'utf8',
    );
    const executionHandoff = JSON.parse(
      await readFile(join(result.topicDir, 'execution-handoff.json'), 'utf8'),
    ) as { status: string };
    const planReview = JSON.parse(
      await readFile(join(result.topicDir, 'plan-review.json'), 'utf8'),
    ) as { status: string };
    const workflowState = JSON.parse(
      await readFile(join(result.topicDir, 'workflow-state.json'), 'utf8'),
    ) as { phase: string };
    const commitMessage = await readFile(
      join(result.topicDir, 'final', 'commit-message.md'),
      'utf8',
    );

    assert.equal(reviewDir.isDirectory(), true);
    assert.equal(finalDir.isDirectory(), true);
    assert.match(brainstorm, /# Brainstorm/);
    assert.match(spec, /# Topic Spec/);
    assert.match(implementationPlan, /# Implementation Plan/);
    assert.equal(executionHandoff.status, 'pending');
    assert.equal(planReview.status, 'pending');
    assert.equal(workflowState.phase, 'bootstrapped');
    assert.match(commitMessage, /# Commit Message/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
