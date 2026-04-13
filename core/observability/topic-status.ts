import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { verifyApprovedPlanFingerprint } from '../planning/plan-review.js';
import { parseMarkdownSections, readPlanSection } from '../planning/implementation-plan.js';

export interface ShiftAxTopicStatusSummary {
  topic_slug: string;
  phase: string;
  review_status: string;
  execution_status: string;
  readiness?: string;
  policy_context_status?: 'not_needed' | 'required' | 'completed';
  plan_fingerprint_status?: 'matched' | 'stale' | 'not_applicable';
  branch_name?: string;
  worktree_path?: string;
  remaining_items?: string[];
  next_step?: string;
  recommended_command?: string;
  latest_checkpoint?: {
    recorded_at?: string;
    summary: string;
  };
  lane_statuses?: Array<{ lane: string; status: string; checked_at?: string }>;
  last_event?: {
    event: string;
    summary: string;
    recorded_at: string;
  };
  last_reaction?: {
    key: string;
    action: string;
    outcome: string;
    recorded_at: string;
  };
  last_failure_reason?: string;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readLatestCheckpoint(
  topicDir: string,
): Promise<ShiftAxTopicStatusSummary['latest_checkpoint'] | undefined> {
  const checkpointDir = join(topicDir, 'checkpoints');
  const files = (await readdir(checkpointDir).catch(() => []))
    .filter((file) => file.endsWith('-summary.md'))
    .sort()
    .reverse();
  const latest = files[0];
  if (!latest) return undefined;
  const raw = await readFile(join(checkpointDir, latest), 'utf8').catch(() => '');
  if (!raw) return undefined;
  const sections = parseMarkdownSections(raw);
  const recordedAt =
    raw.match(/- recorded_at:\s*(.+)/)?.[1]?.trim() || undefined;
  const summary = readPlanSection(sections, 'Summary');
  if (!summary) return undefined;
  return {
    ...(recordedAt ? { recorded_at: recordedAt } : {}),
    summary,
  };
}

async function readHandoffDetails(topicDir: string): Promise<{
  remaining_items?: string[];
  next_step?: string;
  recommended_command?: string;
}> {
  const raw = await readFile(join(topicDir, 'handoff.md'), 'utf8').catch(() => '');
  if (!raw) return {};
  const sections = parseMarkdownSections(raw);
  const remaining = readPlanSection(sections, 'Remaining Items')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const nextStep = readPlanSection(sections, 'Next Step') || undefined;
  const recommendedCommand =
    readPlanSection(sections, 'Recommended Command')
      .replace(/^`|`$/g, '')
      .trim() || undefined;
  return {
    ...(remaining.length > 0 ? { remaining_items: remaining } : {}),
    ...(nextStep ? { next_step: nextStep } : {}),
    ...(recommendedCommand ? { recommended_command: recommendedCommand } : {}),
  };
}

function computeReadiness(input: {
  phase?: string;
  reviewStatus?: string;
  executionStatus?: string;
  policyStatus?: 'not_needed' | 'required' | 'completed';
  fingerprintStatus?: 'matched' | 'stale' | 'not_applicable';
}): string {
  if (input.fingerprintStatus === 'stale') return 'stale_plan';
  if (input.policyStatus === 'required' || input.phase === 'awaiting_policy_sync') {
    return 'policy_sync_required';
  }
  if (input.phase === 'awaiting_plan_review') return 'plan_review_required';
  if (input.phase === 'awaiting_human_escalation') return 'human_escalation_required';
  if (input.phase === 'committed') return 'committed';
  if (input.phase === 'commit_ready') return 'commit_ready';
  if (input.reviewStatus === 'blocked') return 'blocked';
  if (input.reviewStatus === 'changes_requested') return 'implementation_required';
  if (input.reviewStatus === 'approved' && input.executionStatus === 'completed') {
    return 'commit_ready';
  }
  if (input.executionStatus === 'completed') return 'review_pending';
  return 'in_progress';
}

export async function summarizeTopicStatus(topicDir: string): Promise<ShiftAxTopicStatusSummary> {
  const [workflow, executionState, aggregate, policyContextSync, lifecycle, reactions, latestCheckpoint, handoffDetails] = await Promise.all([
    readJson<{
      topic_slug?: string;
      phase?: string;
      review?: { overall_status?: string };
      worktree?: { branch_name?: string; worktree_path?: string };
    }>(join(topicDir, 'workflow-state.json'), {}),
    readJson<{ overall_status?: string }>(join(topicDir, 'execution-state.json'), {}),
    readJson<{ overall_status?: string }>(join(topicDir, 'review', 'aggregate.json'), {}),
    readJson<{ status?: 'not_needed' | 'required' | 'completed' }>(
      join(topicDir, 'policy-context-sync.json'),
      {},
    ),
    readJson<Array<{ event: string; summary: string; recorded_at: string }>>(
      join(topicDir, 'lifecycle-log.json'),
      [],
    ),
    readJson<Array<{ key: string; action: string; outcome: string; recorded_at: string }>>(
      join(topicDir, 'reaction-log.json'),
      [],
    ),
    readLatestCheckpoint(topicDir),
    readHandoffDetails(topicDir),
  ]);
  const laneStatuses = (
    await Promise.all(
      (await readdir(join(topicDir, 'review')).catch(() => []))
        .filter((file) => file.endsWith('.json') && file !== 'aggregate.json')
        .map(async (file) =>
          readJson<{ lane?: string; status?: string; checked_at?: string }>(
            join(topicDir, 'review', file),
            {},
          ),
        ),
    )
  )
    .filter((item) => item.lane && item.status)
    .map((item) => ({
      lane: item.lane!,
      status: item.status!,
      ...(item.checked_at ? { checked_at: item.checked_at } : {}),
    }));
  const fingerprintStatus = await verifyApprovedPlanFingerprint({ topicDir })
    .then((result) => (result.expected ? (result.matches ? 'matched' : 'stale') : 'not_applicable'))
    .catch(() => 'not_applicable' as const);

  const lastEvent = lifecycle.length > 0 ? lifecycle[lifecycle.length - 1] : undefined;
  const lastReaction = reactions.length > 0 ? reactions[reactions.length - 1] : undefined;
  const reviewStatus = workflow.review?.overall_status ?? aggregate.overall_status ?? 'unknown';
  const executionStatus = executionState.overall_status ?? 'unknown';

  return {
    topic_slug: workflow.topic_slug ?? topicDir.split('/').pop() ?? 'unknown-topic',
    phase: workflow.phase ?? 'unknown',
    review_status: reviewStatus,
    execution_status: executionStatus,
    readiness: computeReadiness({
      phase: workflow.phase,
      reviewStatus,
      executionStatus,
      policyStatus: policyContextSync.status,
      fingerprintStatus,
    }),
    ...(policyContextSync.status ? { policy_context_status: policyContextSync.status } : {}),
    ...(fingerprintStatus ? { plan_fingerprint_status: fingerprintStatus } : {}),
    ...(workflow.worktree?.branch_name ? { branch_name: workflow.worktree.branch_name } : {}),
    ...(workflow.worktree?.worktree_path ? { worktree_path: workflow.worktree.worktree_path } : {}),
    ...(handoffDetails.remaining_items ? { remaining_items: handoffDetails.remaining_items } : {}),
    ...(handoffDetails.next_step ? { next_step: handoffDetails.next_step } : {}),
    ...(handoffDetails.recommended_command
      ? { recommended_command: handoffDetails.recommended_command }
      : {}),
    ...(latestCheckpoint ? { latest_checkpoint: latestCheckpoint } : {}),
    ...(laneStatuses.length > 0 ? { lane_statuses: laneStatuses } : {}),
    ...(lastEvent ? { last_event: lastEvent } : {}),
    ...(lastReaction ? { last_reaction: lastReaction } : {}),
    ...(policyContextSync.status === 'required'
      ? { last_failure_reason: 'policy context sync is required before implementation can start' }
      : {}),
    ...(lastEvent && /fail|blocked|changes|requested/i.test(lastEvent.summary)
        ? { last_failure_reason: lastEvent.summary }
        : lastReaction?.outcome && lastReaction.outcome !== 'approved'
          ? { last_failure_reason: `${lastReaction.key}: ${lastReaction.outcome}` }
        : {}),
  };
}
