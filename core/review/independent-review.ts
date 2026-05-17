import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ReviewIssue, ReviewVerdict } from './aggregate-reviews.js';
import type { ShiftAxPlanningReadinessAssessment } from '../planning/readiness-assessment.js';
import type { ShiftAxWorkflowVerification } from '../planning/workflow-state.js';
import { readPlanReviewArtifact } from '../planning/plan-review.js';
import { topicArtifactPath } from '../topics/topic-artifacts.js';

export interface IndependentReviewGateArtifact {
  version: 1;
  lane: 'independent-review';
  reviewer: string;
  reviewer_context: 'clean-file-artifacts-only';
  checked_at: string;
  status: ReviewVerdict['status'];
  summary: string;
  reviewed_artifacts: string[];
  upstream_lanes: Array<{ lane: string; status: ReviewVerdict['status'] }>;
  changed_files: string[];
  execution_state?: {
    overall_status?: string;
    task_count: number;
    completed_task_count: number;
    incomplete_task_count: number;
  };
  verification?: {
    command_count: number;
    passing_count: number;
    failing_count: number;
  };
  issues: ReviewIssue[];
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function listChangedFiles(worktreePath: string): string[] {
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[A-Z?]{1,2}\s+/, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readWorktreePath(topicDir: string): Promise<string | undefined> {
  const raw = await readMaybe(topicArtifactPath(topicDir, 'worktree_state'));
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as { worktree_path?: string }).worktree_path;
  } catch {
    return undefined;
  }
}

async function readReadiness(topicDir: string): Promise<ShiftAxPlanningReadinessAssessment | null> {
  const raw = await readMaybe(topicArtifactPath(topicDir, 'readiness_assessment'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShiftAxPlanningReadinessAssessment;
  } catch {
    return null;
  }
}

async function readExecutionState(topicDir: string): Promise<{
  overall_status?: string;
  tasks?: Array<{ task_id?: string; status?: string; output_path?: string }>;
} | null> {
  const raw = await readMaybe(topicArtifactPath(topicDir, 'execution_state'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      overall_status?: string;
      tasks?: Array<{ task_id?: string; status?: string; output_path?: string }>;
    };
  } catch {
    return null;
  }
}

async function readWorkflowVerification(topicDir: string): Promise<ShiftAxWorkflowVerification[]> {
  const raw = await readMaybe(topicArtifactPath(topicDir, 'workflow_state'));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { verification?: ShiftAxWorkflowVerification[] };
    return parsed.verification ?? [];
  } catch {
    return [];
  }
}

function renderIndependentReviewMarkdown(artifact: IndependentReviewGateArtifact): string {
  return [
    '# Independent Review Gate',
    '',
    `- Reviewer: ${artifact.reviewer}`,
    `- Context: ${artifact.reviewer_context}`,
    `- Status: ${artifact.status}`,
    '',
    '## Contract',
    '',
    'Review the topic as if it came from another implementer. Use only the saved request, resolved context, readiness assessment, spec, plan, execution evidence, verification report, and changed files.',
    '',
    '## Reviewed Artifacts',
    '',
    ...artifact.reviewed_artifacts.map((path) => `- ${path}`),
    '',
    '## Upstream Lane Status',
    '',
    ...artifact.upstream_lanes.map((lane) => `- ${lane.lane}: ${lane.status}`),
    '',
    '## Changed Files',
    '',
    ...(artifact.changed_files.length > 0
      ? artifact.changed_files.map((file) => `- ${file}`)
      : ['- None recorded in worktree status.']),
    '',
    '## Execution Evidence',
    '',
    `- Execution status: ${artifact.execution_state?.overall_status ?? 'missing'}`,
    `- Execution tasks: ${artifact.execution_state?.task_count ?? 0}`,
    `- Completed tasks: ${artifact.execution_state?.completed_task_count ?? 0}`,
    `- Incomplete tasks: ${artifact.execution_state?.incomplete_task_count ?? 0}`,
    `- Verification commands: ${artifact.verification?.command_count ?? 0}`,
    `- Verification failures: ${artifact.verification?.failing_count ?? 0}`,
    '',
    '## Issues',
    '',
    ...(artifact.issues.length > 0
      ? artifact.issues.map((issue) => `- [${issue.severity}] ${issue.message}`)
      : ['- None.']),
    '',
    '## Summary',
    '',
    artifact.summary,
    '',
  ].join('\n');
}

export async function runIndependentReviewGate({
  topicDir,
  upstreamVerdicts,
}: {
  topicDir: string;
  upstreamVerdicts: ReviewVerdict[];
}): Promise<ReviewVerdict> {
  const checkedAt = new Date().toISOString();
  const planReview = await readPlanReviewArtifact(topicDir).catch(() => null);
  const readiness = await readReadiness(topicDir);
  const executionState = await readExecutionState(topicDir);
  const verification = await readWorkflowVerification(topicDir);
  const worktreePath = await readWorktreePath(topicDir);
  const changedFiles = worktreePath ? listChangedFiles(worktreePath) : [];
  const executionTasks = executionState?.tasks ?? [];
  const incompleteExecutionTasks = executionTasks.filter((task) => task.status !== 'completed');
  const verificationFailures = verification.filter((item) => item.exit_code !== 0);
  const verificationPasses = verification.filter((item) => item.exit_code === 0);
  const upstreamIssues = upstreamVerdicts
    .filter((verdict) => verdict.status !== 'approved')
    .map((verdict) => ({
      severity: verdict.status === 'blocked' ? 'high' as const : 'medium' as const,
      message: `Upstream review lane did not approve: ${verdict.lane}.`,
    }));
  const issues: ReviewIssue[] = [
    ...upstreamIssues,
    ...(planReview?.status === 'approved'
      ? []
      : [{ severity: 'high' as const, message: 'Plan review is not approved.' }]),
    ...(readiness?.status === 'ready'
      ? []
      : [{
          severity: 'high' as const,
          message: `Planning readiness is not ready: ${(readiness?.blockers ?? ['missing readiness assessment']).join('; ')}`,
        }]),
    ...(worktreePath
      ? []
      : [{ severity: 'high' as const, message: 'Worktree state is missing; changed-file evidence cannot be reviewed.' }]),
    ...(worktreePath && changedFiles.length === 0
      ? [{ severity: 'high' as const, message: 'No changed files are present in the implementation worktree.' }]
      : []),
    ...(executionState?.overall_status === 'completed' && executionTasks.length > 0
      ? []
      : [{
          severity: 'high' as const,
          message: `Execution evidence is incomplete: execution-state.json reports ${executionState?.overall_status ?? 'missing'} with ${executionTasks.length} task(s).`,
        }]),
    ...(incompleteExecutionTasks.length === 0
      ? []
      : [{
          severity: 'high' as const,
          message: `Execution evidence contains ${incompleteExecutionTasks.length} incomplete task(s): ${incompleteExecutionTasks.map((task) => `${task.task_id ?? 'unknown'}=${task.status ?? 'missing'}`).join(', ')}.`,
        }]),
    ...(verification.length > 0 && verificationFailures.length === 0
      ? []
      : [{
          severity: 'high' as const,
          message: verification.length === 0
            ? 'Workflow verification evidence is missing.'
            : `Workflow verification has ${verificationFailures.length} failing command(s).`,
        }]),
  ];
  const status: ReviewVerdict['status'] =
    issues.some((issue) => issue.severity === 'high' || issue.severity === 'critical')
      ? 'changes_requested'
      : issues.length > 0
        ? 'changes_requested'
        : 'approved';
  const summary = status === 'approved'
    ? 'Clean-context independent review found approved upstream lanes, approved plan review, ready ambiguity score, and reviewable execution evidence.'
    : 'Clean-context independent review found blockers that must be resolved before finalization.';
  const artifact: IndependentReviewGateArtifact = {
    version: 1,
    lane: 'independent-review',
    reviewer: 'Shift AX independent review gate',
    reviewer_context: 'clean-file-artifacts-only',
    checked_at: checkedAt,
    status,
    summary,
    reviewed_artifacts: [
      'request.md',
      'resolved-context.json',
      'readiness-assessment.json',
      'brainstorm.md',
      'spec.md',
      'implementation-plan.md',
      'plan-review.json',
      'workflow-state.json',
      'execution-state.json',
      'final/verification.md',
    ],
    upstream_lanes: upstreamVerdicts.map((verdict) => ({
      lane: verdict.lane,
      status: verdict.status,
    })),
    changed_files: changedFiles,
    execution_state: executionState
      ? {
          overall_status: executionState.overall_status,
          task_count: executionTasks.length,
          completed_task_count: executionTasks.filter((task) => task.status === 'completed').length,
          incomplete_task_count: incompleteExecutionTasks.length,
        }
      : undefined,
    verification: {
      command_count: verification.length,
      passing_count: verificationPasses.length,
      failing_count: verificationFailures.length,
    },
    issues,
  };

  await Promise.all([
    writeFile(
      join(topicDir, 'review', 'independent-review-gate.json'),
      `${JSON.stringify(artifact, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      join(topicDir, 'review', 'independent-review.md'),
      renderIndependentReviewMarkdown(artifact),
      'utf8',
    ),
  ]);

  return {
    version: 1,
    lane: 'independent-review',
    status,
    checked_at: checkedAt,
    summary,
    ...(issues.length > 0 ? { issues } : {}),
    reviewer: artifact.reviewer,
    reviewer_context: artifact.reviewer_context,
    gate_artifact: 'review/independent-review-gate.json',
    review_prompt: 'review/independent-review.md',
  };
}
