import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { topicArtifactPath } from '../topics/topic-artifacts.js';
import { recordLifecycleEvent } from './lifecycle-events.js';
import { readPolicyContextSyncArtifact } from './policy-context-sync.js';
import {
  readWorkflowState,
  writeWorkflowState,
} from './workflow-state.js';

export interface ShiftAxApprovedPlanFingerprint {
  plan_path: string;
  sha256: string;
}

export interface ShiftAxPlanReviewArtifact {
  version: 1;
  status: 'pending' | 'approved' | 'changes_requested';
  reviewer?: string;
  reviewed_at?: string;
  notes?: string;
  approved_plan_fingerprint?: ShiftAxApprovedPlanFingerprint;
}

export interface RecordPlanReviewDecisionInput {
  topicDir: string;
  reviewer: string;
  status: 'approved' | 'changes_requested';
  notes?: string;
  now?: Date;
}

export interface ApprovedPlanFingerprintCheck {
  matches: boolean;
  expected?: ShiftAxApprovedPlanFingerprint;
  actual_sha256?: string;
  reason?: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readPlanFile(topicDir: string): Promise<string> {
  return readFile(topicArtifactPath(topicDir, 'implementation_plan'), 'utf8');
}

export async function readPlanReviewArtifact(
  topicDir: string,
): Promise<ShiftAxPlanReviewArtifact> {
  const raw = await readFile(topicArtifactPath(topicDir, 'plan_review'), 'utf8');
  return JSON.parse(raw) as ShiftAxPlanReviewArtifact;
}

export async function writePlanReviewArtifact(
  topicDir: string,
  artifact: ShiftAxPlanReviewArtifact,
): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'plan_review'),
    `${JSON.stringify(artifact, null, 2)}\n`,
    'utf8',
  );
}

export async function recordPlanReviewDecision({
  topicDir,
  reviewer,
  status,
  notes,
  now = new Date(),
}: RecordPlanReviewDecisionInput): Promise<ShiftAxPlanReviewArtifact> {
  const planContent = await readPlanFile(topicDir);
  const fingerprint =
    status === 'approved'
      ? {
          plan_path: 'implementation-plan.md',
          sha256: sha256(planContent),
        }
      : undefined;

  const artifact: ShiftAxPlanReviewArtifact = {
    version: 1,
    status,
    reviewer,
    reviewed_at: now.toISOString(),
    ...(notes ? { notes } : {}),
    ...(fingerprint ? { approved_plan_fingerprint: fingerprint } : {}),
  };

  await writePlanReviewArtifact(topicDir, artifact);

  const workflow = await readWorkflowState(topicDir);
  workflow.plan_review_status = status;
  const policyContextSync = await readPolicyContextSyncArtifact(topicDir);
  workflow.phase =
    status === 'approved'
      ? policyContextSync.status === 'required'
        ? 'awaiting_policy_sync'
        : 'approved'
      : 'awaiting_plan_review';
  workflow.updated_at = now.toISOString();
  await writeWorkflowState(topicDir, workflow);

  if (status === 'approved' && policyContextSync.status === 'required') {
    await recordLifecycleEvent({
      topicDir,
      phase: workflow.phase,
      event: 'policy.sync_required',
      summary: 'Plan approval requires shared base-context policy updates before implementation can start.',
      now,
    });
  }

  return artifact;
}

export async function verifyApprovedPlanFingerprint({
  topicDir,
}: {
  topicDir: string;
}): Promise<ApprovedPlanFingerprintCheck> {
  const review = await readPlanReviewArtifact(topicDir);
  if (review.status !== 'approved' || !review.approved_plan_fingerprint) {
    return {
      matches: false,
      reason: 'plan review is not approved',
    };
  }

  const currentSha = sha256(await readPlanFile(topicDir));
  return {
    matches: currentSha === review.approved_plan_fingerprint.sha256,
    expected: review.approved_plan_fingerprint,
    actual_sha256: currentSha,
    ...(currentSha === review.approved_plan_fingerprint.sha256
      ? {}
      : { reason: 'approved plan fingerprint does not match current plan' }),
  };
}
