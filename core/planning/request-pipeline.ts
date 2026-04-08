import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

import { resolveContextFromIndex } from '../context/index-resolver.js';
import { ensureTopicCommitMessageArtifact } from '../finalization/commit-workflow.js';
import { finalizeTopicCommit, type FinalizeTopicCommitResult } from '../finalization/commit-workflow.js';
import { readProjectProfile } from '../policies/project-profile.js';
import {
  aggregateReviewVerdicts,
  type AggregateReviewsResult,
  writeAggregateReviewArtifacts,
} from '../review/aggregate-reviews.js';
import { runReviewLanes } from '../review/run-lanes.js';
import {
  bootstrapTopic,
  type TopicBootstrapResult,
} from '../topics/bootstrap.js';
import {
  topicArtifactPath,
  getRootDirFromTopicDir,
} from '../topics/topic-artifacts.js';
import {
  createTopicWorktree,
  type TopicWorktreeCreateResult,
} from '../topics/worktree-runtime.js';
import { verifyApprovedPlanFingerprint } from './plan-review.js';
import {
  clearWorkflowEscalations,
  recordWorkflowEscalations,
  type ShiftAxWorkflowEscalationInput,
} from './escalation.js';
import { writeExecutionHandoff } from './execution-handoff.js';
import type { ShiftAxExecutionState } from './execution-orchestrator.js';
import { recordLifecycleEvent } from './lifecycle-events.js';
import {
  inferPolicyContextSyncArtifact,
  readPolicyContextSyncArtifact,
  writePolicyContextSyncArtifact,
} from './policy-context-sync.js';
import {
  hasActiveWorkflowEscalations,
  readWorkflowState,
  writeWorkflowState,
  type ShiftAxWorkflowState,
  type ShiftAxWorkflowVerification,
} from './workflow-state.js';

const execFileAsync = promisify(execFile);

export interface StartRequestPipelineInput {
  rootDir: string;
  request: string;
  summary?: string;
  indexPath?: string;
  contextQuery?: string;
  maxMatches?: number;
  brainstormContent?: string;
  specContent?: string;
  implementationPlanContent?: string;
  baseBranch?: string;
  now?: Date;
}

export interface StartRequestPipelineResult extends TopicBootstrapResult {
  resolvedContext: Awaited<ReturnType<typeof resolveRequestContext>>;
  worktree: TopicWorktreeCreateResult;
  workflow: ShiftAxWorkflowState;
}

export interface ResumeRequestPipelineInput {
  topicDir: string;
  verificationCommands?: string[];
  escalationTriggers?: ShiftAxWorkflowEscalationInput[];
  clearEscalations?: boolean;
  escalationResolution?: string;
  autoCommit?: boolean;
  executionRunner?: (input: {
    topicDir: string;
    worktreePath: string;
  }) => Promise<ShiftAxExecutionState>;
  now?: Date;
}

export interface ResumeRequestPipelineResult {
  workflow: ShiftAxWorkflowState;
  aggregate: AggregateReviewsResult;
  verification: ShiftAxWorkflowVerification[];
  finalization?: FinalizeTopicCommitResult;
}

async function resolveRequestContext({
  rootDir,
  request,
  contextQuery,
  indexPath = join(rootDir, 'docs', 'base-context', 'index.md'),
  maxMatches = 5,
}: {
  rootDir: string;
  request: string;
  contextQuery?: string;
  indexPath?: string;
  maxMatches?: number;
}) {
  const effectiveQuery = contextQuery?.trim() || request.trim();

  if (existsSync(indexPath)) {
    return resolveContextFromIndex({
      rootDir,
      indexPath,
      query: effectiveQuery,
      maxMatches,
    });
  }

  return {
    version: 1 as const,
    index_path: indexPath,
    query: effectiveQuery,
    matches: [],
    unresolved_paths: [relative(rootDir, indexPath) || indexPath],
  };
}

function buildDefaultBrainstorm(request: string, matchedLabels: string[]): string {
  return [
    '# Brainstorm',
    '',
    '## Request',
    '',
    request.trim(),
    '',
    '## Relevant Context',
    '',
    ...(matchedLabels.length > 0 ? matchedLabels.map((label) => `- ${label}`) : ['- No matched context documents yet.']),
    '',
    '## Base-Context Policy Updates',
    '',
    '- None yet.',
    '',
  ].join('\n');
}

function buildDefaultSpec(request: string, matchedLabels: string[]): string {
  return [
    '# Topic Spec',
    '',
    '## Goal',
    '',
    request.trim(),
    '',
    '## Relevant Context',
    '',
    ...(matchedLabels.length > 0 ? matchedLabels.map((label) => `- ${label}`) : ['- No matched context documents yet.']),
    '',
    '## Base-Context Policy Updates',
    '',
    '- None yet.',
    '',
  ].join('\n');
}

function buildDefaultImplementationPlan(testStrategy: string, architecture: string): string {
  return [
    '# Implementation Plan',
    '',
    `Use ${testStrategy.toUpperCase()} first.`,
    `Respect ${architecture.replace(/-/g, ' ')}.`,
    'Add focused verification steps before commit finalization.',
    '',
    '## Base-Context Policy Updates',
    '',
    '- None yet.',
    '',
  ].join('\n');
}

async function writeVerificationReport(
  topicDir: string,
  verification: ShiftAxWorkflowVerification[],
): Promise<void> {
  const lines = ['# Final Verification', ''];

  if (verification.length === 0) {
    lines.push('No verification commands were provided.');
  } else {
    for (const item of verification) {
      lines.push(`## ${item.command}`);
      lines.push('');
      lines.push(`- exit_code: ${item.exit_code}`);
      lines.push('');
      lines.push('```text');
      lines.push(item.stdout.trim() || item.stderr.trim() || '(no output)');
      lines.push('```');
      lines.push('');
    }
  }

  await writeFile(topicArtifactPath(topicDir, 'verification'), `${lines.join('\n')}\n`, 'utf8');
}

async function runVerificationCommands(
  cwd: string,
  commands: string[],
): Promise<ShiftAxWorkflowVerification[]> {
  const results: ShiftAxWorkflowVerification[] = [];

  for (const command of commands) {
    try {
      const { stdout, stderr } = await execFileAsync('/bin/sh', ['-lc', command], { cwd });
      results.push({
        command,
        exit_code: 0,
        stdout,
        stderr,
      });
    } catch (error) {
      const failed = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
      };
      results.push({
        command,
        exit_code: typeof failed.code === 'number' ? failed.code : 1,
        stdout: failed.stdout ?? '',
        stderr: failed.stderr ?? '',
      });
      break;
    }
  }

  return results;
}

async function resolveExecutionCwd(topicDir: string): Promise<string> {
  const rootDir = getRootDirFromTopicDir(topicDir);

  try {
    const raw = await readFile(topicArtifactPath(topicDir, 'worktree_state'), 'utf8');
    const state = JSON.parse(raw) as { worktree_path?: string; status?: string };
    if (
      state.worktree_path &&
      ['created', 'reused'].includes(String(state.status || '')) &&
      existsSync(state.worktree_path)
    ) {
      return state.worktree_path;
    }
  } catch {
    // fall back to rootDir
  }

  return rootDir;
}

async function assertResolvedContextReady(topicDir: string): Promise<void> {
  const raw = await readFile(topicArtifactPath(topicDir, 'resolved_context'), 'utf8').catch(() => '');
  if (!raw) {
    throw new Error('resolved context artifact is missing');
  }

  const parsed = JSON.parse(raw) as { unresolved_paths?: string[] };
  if ((parsed.unresolved_paths ?? []).length > 0) {
    throw new Error('resolved context still has unresolved base-context paths');
  }
}

export async function startRequestPipeline({
  rootDir,
  request,
  summary,
  indexPath,
  contextQuery,
  maxMatches,
  brainstormContent,
  specContent,
  implementationPlanContent,
  baseBranch = 'main',
  now = new Date(),
}: StartRequestPipelineInput): Promise<StartRequestPipelineResult> {
  const topic = await bootstrapTopic({
    rootDir,
    request,
    summary,
    now,
  });
  const profile = await readProjectProfile(rootDir);
  const resolvedContext = await resolveRequestContext({
    rootDir,
    request,
    contextQuery,
    indexPath,
    maxMatches,
  });
  const matchedLabels = resolvedContext.matches.map((match) => match.label);
  if (resolvedContext.unresolved_paths.length > 0) {
    throw new Error('resolved context still has unresolved base-context paths');
  }

  await writeFile(
    topicArtifactPath(topic.topicDir, 'resolved_context'),
    `${JSON.stringify(resolvedContext, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    topicArtifactPath(topic.topicDir, 'brainstorm'),
    `${brainstormContent ?? buildDefaultBrainstorm(request, matchedLabels)}\n`,
    'utf8',
  );
  await writeFile(
    topicArtifactPath(topic.topicDir, 'spec'),
    `${specContent ?? buildDefaultSpec(request, matchedLabels)}\n`,
    'utf8',
  );
  await writeFile(
    topicArtifactPath(topic.topicDir, 'implementation_plan'),
    `${implementationPlanContent ?? buildDefaultImplementationPlan(
      profile?.engineering_defaults.test_strategy ?? 'tdd',
      profile?.engineering_defaults.architecture ?? 'clean-boundaries',
    )}\n`,
    'utf8',
  );
  await writePolicyContextSyncArtifact(
    topic.topicDir,
    inferPolicyContextSyncArtifact({
      brainstormContent: brainstormContent ?? buildDefaultBrainstorm(request, matchedLabels),
      specContent: specContent ?? buildDefaultSpec(request, matchedLabels),
      implementationPlanContent:
        implementationPlanContent ??
        buildDefaultImplementationPlan(
          profile?.engineering_defaults.test_strategy ?? 'tdd',
          profile?.engineering_defaults.architecture ?? 'clean-boundaries',
        ),
      now,
    }),
  );
  await writeExecutionHandoff(topic.topicDir, now);

  const worktree = await createTopicWorktree({
    topicDir: topic.topicDir,
    baseBranch,
  });

  const workflow: ShiftAxWorkflowState = {
    ...(await readWorkflowState(topic.topicDir)),
    updated_at: now.toISOString(),
    phase: 'awaiting_plan_review',
    plan_review_status: 'pending',
    worktree: {
      branch_name: worktree.branch_name,
      worktree_path: worktree.worktree_path,
      base_branch: worktree.base_branch,
    },
    resolved_context: {
      index_path: resolvedContext.index_path,
      query: resolvedContext.query,
      matches: resolvedContext.matches.length,
      unresolved_paths: resolvedContext.unresolved_paths,
    },
    escalation: {
      status: 'clear',
      triggers: [],
    },
  };
  await writeWorkflowState(topic.topicDir, workflow);
  await recordLifecycleEvent({
    topicDir: topic.topicDir,
    phase: workflow.phase,
    event: 'plan.review_required',
    summary: 'Waiting for the human plan review.',
    now,
  });

  return {
    ...topic,
    resolvedContext,
    worktree,
    workflow,
  };
}

export async function resumeRequestPipeline({
  topicDir,
  verificationCommands = [],
  escalationTriggers = [],
  clearEscalations = false,
  escalationResolution,
  autoCommit = false,
  executionRunner,
  now = new Date(),
}: ResumeRequestPipelineInput): Promise<ResumeRequestPipelineResult> {
  if (clearEscalations) {
    await clearWorkflowEscalations({
      topicDir,
      resolution: escalationResolution,
      now,
    });
  }

  if (escalationTriggers.length > 0) {
    await recordWorkflowEscalations({
      topicDir,
      triggers: escalationTriggers,
      now,
    });
    await recordLifecycleEvent({
      topicDir,
      phase: 'awaiting_human_escalation',
      event: 'execution.blocked',
      summary: 'Execution stopped because a mandatory escalation trigger was raised.',
      reaction: {
        key: escalationTriggers[0]!.kind,
        action: 'await_human_escalation',
        outcome: 'blocked',
      },
      now,
    });
    throw new Error(
      'workflow requires human escalation review before automation can continue',
    );
  }

  const fingerprint = await verifyApprovedPlanFingerprint({ topicDir });
  if (!fingerprint.matches) {
    throw new Error(fingerprint.reason ?? 'approved plan fingerprint check failed');
  }
  await assertResolvedContextReady(topicDir);

  const workflow = await readWorkflowState(topicDir);
  if (hasActiveWorkflowEscalations(workflow)) {
    throw new Error(
      'workflow has active escalation triggers; resolve them before resuming automation',
    );
  }
  const policyContextSync = await readPolicyContextSyncArtifact(topicDir);
  if (policyContextSync.status === 'required') {
    workflow.phase = 'awaiting_policy_sync';
    workflow.updated_at = now.toISOString();
    await writeWorkflowState(topicDir, workflow);
    throw new Error(
      'policy context sync is required before implementation can start',
    );
  }
  workflow.phase = 'implementation_running';
  workflow.plan_review_status = 'approved';
  workflow.updated_at = now.toISOString();
  await writeWorkflowState(topicDir, workflow);
  await recordLifecycleEvent({
    topicDir,
    phase: workflow.phase,
    event: 'execution.started',
    summary: 'Execution resumed after human plan approval.',
    now,
  });

  const executionCwd = await resolveExecutionCwd(topicDir);
  if (executionRunner) {
    const executionState = await executionRunner({
      topicDir,
      worktreePath: executionCwd,
    });
    await writeFile(
      topicArtifactPath(topicDir, 'execution_state'),
      `${JSON.stringify(executionState, null, 2)}\n`,
      'utf8',
    );
    if (executionState.overall_status !== 'completed') {
      throw new Error('execution orchestration failed');
    }
  }

  const verification = await runVerificationCommands(executionCwd, verificationCommands);
  await writeVerificationReport(topicDir, verification);
  workflow.verification = verification;

  if (verification.some((item) => item.exit_code !== 0)) {
    workflow.updated_at = now.toISOString();
    await writeWorkflowState(topicDir, workflow);
    throw new Error('verification commands failed');
  }

  workflow.phase = 'review_pending';
  workflow.updated_at = now.toISOString();
  await writeWorkflowState(topicDir, workflow);
  await recordLifecycleEvent({
    topicDir,
    phase: workflow.phase,
    event: 'review.started',
    summary: 'Structured review lanes are running.',
    now,
  });

  await runReviewLanes({ topicDir });
  const aggregate = await aggregateReviewVerdicts({ topicDir });
  await writeAggregateReviewArtifacts(topicDir, aggregate);

  workflow.review = {
    overall_status: aggregate.overall_status,
    commit_allowed: aggregate.commit_allowed,
    next_stage: aggregate.next_stage,
  };

  if (aggregate.commit_allowed) {
    await ensureTopicCommitMessageArtifact({
      topicDir,
      verification,
    });
  }

  workflow.phase = aggregate.commit_allowed ? 'commit_ready' : 'implementation_running';
  workflow.updated_at = now.toISOString();
  await writeWorkflowState(topicDir, workflow);
  await recordLifecycleEvent({
    topicDir,
    phase: workflow.phase,
    event: 'review.completed',
    summary: aggregate.commit_allowed
      ? 'Review passed and the topic is commit-ready.'
      : 'Review requested more implementation work.',
    ...(aggregate.commit_allowed
      ? {}
      : {
          reaction: {
            key: 'review-changes-requested',
            action: 'return_to_implementation',
            outcome: 'changes_requested',
          },
        }),
    now,
  });

  let finalization: FinalizeTopicCommitResult | undefined;
  if (aggregate.commit_allowed && autoCommit) {
    finalization = await finalizeTopicCommit({
      topicDir,
      now,
    });
    workflow.phase = 'committed';
    workflow.updated_at = now.toISOString();
    await writeWorkflowState(topicDir, workflow);
    await recordLifecycleEvent({
      topicDir,
      phase: workflow.phase,
      event: 'finalization.committed',
      summary: 'Automatic finalization created the local commit.',
      now,
    });
  }

  return {
    workflow,
    aggregate,
    verification,
    ...(finalization ? { finalization } : {}),
  };
}

export { readWorkflowState } from './workflow-state.js';
