import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { applyFeedbackReaction } from '../core/planning/feedback-reactions.js';
import { summarizeTopicStatus } from '../core/observability/topic-status.js';
import { topicArtifactPath } from '../core/topics/topic-artifacts.js';
import { bootstrapTopic } from '../core/topics/bootstrap.js';
import { readReactionRecords } from '../core/planning/lifecycle-events.js';

test('applyFeedbackReaction reopens implementation when CI fails after commit readiness', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-feedback-reaction-'));

  try {
    const topic = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
    });

    await mkdir(join(topic.topicDir, 'review'), { recursive: true });
    await writeFile(
      topicArtifactPath(topic.topicDir, 'workflow_state'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: topic.topicSlug,
          phase: 'commit_ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
          review: {
            overall_status: 'approved',
            commit_allowed: true,
            next_stage: 'finalization',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topic.topicDir, 'review', 'aggregate.json'),
      JSON.stringify(
        {
          version: 1,
          overall_status: 'approved',
          commit_allowed: true,
          next_stage: 'finalization',
          required_lanes: [],
          approved_lanes: [],
          changes_requested_lanes: [],
          blocked_lanes: [],
          missing_lanes: [],
          verdicts: [],
        },
        null,
        2,
      ),
      'utf8',
    );

    const result = await applyFeedbackReaction({
      topicDir: topic.topicDir,
      kind: 'ci-failed',
      summary: 'CI failed in the downstream smoke test job.',
    });

    assert.equal(result.workflow.phase, 'implementation_running');
    assert.equal(result.workflow.review?.overall_status, 'blocked');
    assert.equal(result.aggregate.commit_allowed, false);

    const status = await summarizeTopicStatus(topic.topicDir);
    assert.equal(status.phase, 'implementation_running');
    assert.equal(status.review_status, 'blocked');
    assert.match(status.last_failure_reason ?? '', /CI failed/i);

    const reactions = await readReactionRecords(topic.topicDir);
    assert.equal(reactions.at(-1)?.key, 'ci-failed');
    assert.equal(reactions.at(-1)?.action, 'reopen_execution');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('applyFeedbackReaction records review-changes-requested as implementation work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-feedback-review-'));

  try {
    const topic = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
    });

    await writeFile(
      topicArtifactPath(topic.topicDir, 'workflow_state'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: topic.topicSlug,
          phase: 'committed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
          review: {
            overall_status: 'approved',
            commit_allowed: true,
            next_stage: 'finalization',
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const result = await applyFeedbackReaction({
      topicDir: topic.topicDir,
      kind: 'review-changes-requested',
      summary: 'Reviewer requested a safer auth refresh rollback path.',
    });

    assert.equal(result.workflow.phase, 'implementation_running');
    assert.equal(result.workflow.review?.overall_status, 'changes_requested');
    assert.equal(result.aggregate.next_stage, 'implementation');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
