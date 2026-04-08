import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AggregateReviewsResult, ReviewVerdict } from '../review/aggregate-reviews.js';
import { renderReviewSummaryMarkdown } from '../review/aggregate-reviews.js';
import { readWorkflowState, writeWorkflowState, type ShiftAxWorkflowState } from './workflow-state.js';
import { recordLifecycleEvent } from './lifecycle-events.js';

export type ShiftAxFeedbackReactionKind =
  | 'review-changes-requested'
  | 'ci-failed';

export interface ShiftAxFeedbackReactionResult {
  workflow: ShiftAxWorkflowState;
  aggregate: AggregateReviewsResult;
  feedback_verdict: ReviewVerdict;
}

function buildFeedbackVerdict({
  kind,
  summary,
  now,
}: {
  kind: ShiftAxFeedbackReactionKind;
  summary: string;
  now: Date;
}): ReviewVerdict {
  return {
    version: 1,
    lane: 'downstream-feedback',
    status: kind === 'ci-failed' ? 'blocked' : 'changes_requested',
    checked_at: now.toISOString(),
    summary,
  };
}

function buildFeedbackAggregate(verdict: ReviewVerdict): AggregateReviewsResult {
  return {
    version: 1,
    overall_status: verdict.status,
    commit_allowed: false,
    next_stage: 'implementation',
    required_lanes: [],
    approved_lanes: [],
    changes_requested_lanes:
      verdict.status === 'changes_requested' ? ['downstream-feedback'] : [],
    blocked_lanes:
      verdict.status === 'blocked' ? ['downstream-feedback'] : [],
    missing_lanes: [],
    verdicts: [verdict],
  };
}

async function writeFeedbackArtifacts(
  topicDir: string,
  verdict: ReviewVerdict,
  aggregate: AggregateReviewsResult,
): Promise<void> {
  const reviewDir = join(topicDir, 'review');
  await Promise.all([
    writeFile(
      join(reviewDir, 'downstream-feedback.json'),
      `${JSON.stringify(verdict, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      join(reviewDir, 'aggregate.json'),
      `${JSON.stringify(aggregate, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      join(reviewDir, 'summary.md'),
      renderReviewSummaryMarkdown(aggregate),
      'utf8',
    ),
  ]);
}

export async function applyFeedbackReaction({
  topicDir,
  kind,
  summary,
  now = new Date(),
}: {
  topicDir: string;
  kind: ShiftAxFeedbackReactionKind;
  summary: string;
  now?: Date;
}): Promise<ShiftAxFeedbackReactionResult> {
  if (!summary.trim()) {
    throw new Error('feedback summary is required');
  }

  const workflow = await readWorkflowState(topicDir);
  workflow.phase = 'implementation_running';
  workflow.updated_at = now.toISOString();
  workflow.review = {
    overall_status: kind === 'ci-failed' ? 'blocked' : 'changes_requested',
    commit_allowed: false,
    next_stage: 'implementation',
  };
  delete workflow.verification;
  await writeWorkflowState(topicDir, workflow);

  const verdict = buildFeedbackVerdict({
    kind,
    summary: summary.trim(),
    now,
  });
  const aggregate = buildFeedbackAggregate(verdict);
  await writeFeedbackArtifacts(topicDir, verdict, aggregate);

  await recordLifecycleEvent({
    topicDir,
    phase: workflow.phase,
    event: 'feedback.received',
    summary: summary.trim(),
    reaction: {
      key: kind,
      action: 'reopen_execution',
      outcome: verdict.status,
    },
    now,
  });

  return {
    workflow,
    aggregate,
    feedback_verdict: verdict,
  };
}
