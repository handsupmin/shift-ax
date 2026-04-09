import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildWorktreePlan } from './worktree.js';
import { defaultTopicArtifacts } from './topic-artifacts.js';

export interface TopicBootstrapInput {
  rootDir: string;
  request: string;
  summary?: string;
  now?: Date;
}

export interface TopicBootstrapArtifacts {
  request: string;
  request_summary: string;
  resolved_context: string;
  brainstorm: string;
  spec: string;
  plan_review: string;
  policy_context_sync: string;
  implementation_plan: string;
  execution_handoff: string;
  execution_state: string;
  workflow_state: string;
  review_dir: string;
  final_dir: string;
  commit_message: string;
  commit_state: string;
  verification: string;
  worktree_plan: string;
  worktree_state: string;
}

export interface TopicBootstrapMetadata {
  version: 1;
  topic_slug: string;
  created_at: string;
  status: 'bootstrapped';
  artifacts: TopicBootstrapArtifacts;
}

export interface TopicBootstrapResult {
  topicSlug: string;
  topicDir: string;
  metadata: TopicBootstrapMetadata;
}

function timestampForSlug(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function slugifyTopic(input: string): string {
  const normalized = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'topic';
}

export function summarizeRequest(request: string): string {
  const compact = String(request || '').trim().replace(/\s+/g, ' ');
  if (compact.length <= 160) return compact;
  return `${compact.slice(0, 157)}...`;
}

export function buildTopicSlug(request: string, now = new Date()): string {
  return `${timestampForSlug(now)}-${slugifyTopic(request).slice(0, 48)}`;
}

export async function bootstrapTopic({
  rootDir,
  request,
  summary,
  now = new Date(),
}: TopicBootstrapInput): Promise<TopicBootstrapResult> {
  if (!rootDir) throw new Error('rootDir is required');
  if (!request || String(request).trim() === '') {
    throw new Error('request is required');
  }

  const topicSlug = buildTopicSlug(request, now);
  const topicDir = join(rootDir, '.ax', 'topics', topicSlug);
  const artifacts = defaultTopicArtifacts();

  await mkdir(topicDir, { recursive: true });

  const requestContent = `${String(request).trim()}\n`;
  const requestSummary =
    (summary && String(summary).trim()) || summarizeRequest(request);
  const requestSummaryContent = `${requestSummary}\n`;
  const resolvedContextContent = `${JSON.stringify(
    {
      version: 1,
      request: String(request).trim(),
      matches: [],
      unresolved_paths: [],
    },
    null,
    2,
  )}\n`;
  const brainstormContent =
    '# Brainstorm\n\n> Shift AX placeholder: planning interview notes must replace this section before review.\n';
  const specContent =
    '# Topic Spec\n\n## Goal\n\n> Shift AX placeholder: define the reviewed goal before implementation.\n';
  const planReviewContent = `${JSON.stringify({ version: 1, status: 'pending' }, null, 2)}\n`;
  const policyContextSyncContent = `${JSON.stringify(
    {
      version: 1,
      status: 'not_needed',
      required_updates: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    null,
    2,
  )}\n`;
  const implementationPlanContent =
    '# Implementation Plan\n\n> Shift AX placeholder: write the reviewed implementation steps before execution.\n';
  const executionHandoffContent = `${JSON.stringify(
    {
      version: 1,
      status: 'pending',
      tasks: [],
    },
    null,
    2,
  )}\n`;
  const executionStateContent = `${JSON.stringify(
    {
      version: 1,
      overall_status: 'pending',
      tasks: [],
    },
    null,
    2,
  )}\n`;
  const workflowStateContent = `${JSON.stringify(
    {
      version: 1,
      topic_slug: topicSlug,
      phase: 'bootstrapped',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      plan_review_status: 'pending',
      escalation: {
        status: 'clear',
        triggers: [],
      },
    },
    null,
    2,
  )}\n`;
  const commitMessageContent =
    '# Commit Message\n\n> Shift AX placeholder: generate or write the Lore commit message before finalization.\n';
  const commitStateContent = `${JSON.stringify({ version: 1, status: 'not_committed' }, null, 2)}\n`;
  const verificationContent =
    '# Final Verification\n\n> Shift AX placeholder: record verification evidence before finalization.\n';
  const worktreePlan = buildWorktreePlan({
    rootDir,
    topicSlug,
    request,
  });

  const metadata: TopicBootstrapMetadata = {
    version: 1,
    topic_slug: topicSlug,
    created_at: now.toISOString(),
    status: 'bootstrapped',
    artifacts,
  };

  await Promise.all([
    mkdir(join(topicDir, artifacts.review_dir), { recursive: true }),
    mkdir(join(topicDir, artifacts.final_dir), { recursive: true }),
    writeFile(join(topicDir, artifacts.request), requestContent, 'utf8'),
    writeFile(join(topicDir, artifacts.request_summary), requestSummaryContent, 'utf8'),
    writeFile(join(topicDir, artifacts.resolved_context), resolvedContextContent, 'utf8'),
    writeFile(join(topicDir, artifacts.brainstorm), brainstormContent, 'utf8'),
    writeFile(join(topicDir, artifacts.spec), specContent, 'utf8'),
    writeFile(join(topicDir, artifacts.plan_review), planReviewContent, 'utf8'),
    writeFile(join(topicDir, artifacts.policy_context_sync), policyContextSyncContent, 'utf8'),
    writeFile(
      join(topicDir, artifacts.implementation_plan),
      implementationPlanContent,
      'utf8',
    ),
    writeFile(join(topicDir, artifacts.execution_handoff), executionHandoffContent, 'utf8'),
    writeFile(join(topicDir, artifacts.execution_state), executionStateContent, 'utf8'),
    writeFile(join(topicDir, artifacts.workflow_state), workflowStateContent, 'utf8'),
    writeFile(join(topicDir, artifacts.commit_message), commitMessageContent, 'utf8'),
    writeFile(join(topicDir, artifacts.commit_state), commitStateContent, 'utf8'),
    writeFile(join(topicDir, artifacts.verification), verificationContent, 'utf8'),
    writeFile(join(topicDir, artifacts.worktree_plan), `${JSON.stringify(worktreePlan, null, 2)}\n`, 'utf8'),
    writeFile(
      join(topicDir, artifacts.worktree_state),
      `${JSON.stringify({ version: 1, status: 'not_created' }, null, 2)}\n`,
      'utf8',
    ),
    writeFile(join(topicDir, 'topic.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8'),
  ]);

  return {
    topicSlug,
    topicDir,
    metadata,
  };
}
