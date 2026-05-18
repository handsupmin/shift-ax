import { writeFile } from 'node:fs/promises';

import { topicArtifactPath } from '../topics/topic-artifacts.js';
import type { TopicWorktreeCreateResult } from '../topics/worktree-runtime.js';
import type { ShiftAxExecutionHandoff } from './execution-handoff.js';
import {
  extractMarkdownBullets,
  parseMarkdownSections,
  readPlanSection,
} from './implementation-plan.js';
import type { ShiftAxPlanningReadinessAssessment } from './readiness-assessment.js';

export interface ShiftAxPlanReviewBrief {
  version: 1;
  status: 'requires_human_review';
  generated_at: string;
  topic_dir: string;
  worktree_path: string;
  request: string;
  goal: string;
  matched_context: string[];
  constraints: string[];
  out_of_scope: string[];
  acceptance_criteria: string[];
  likely_files_touched: string[];
  verification_commands: string[];
  execution_tasks: Array<{
    id: string;
    summary: string;
    execution_mode: 'subagent' | 'tmux';
  }>;
  readiness: {
    status: ShiftAxPlanningReadinessAssessment['status'];
    ambiguity_score: number;
    ambiguity_threshold: number;
    blockers: string[];
  };
  review_prompt: string;
  response_options: Array<{
    value: '1' | '2' | '3';
    label: string;
    action: 'approve_and_continue' | 'request_changes' | 'reject';
    assistant_behavior: string;
  }>;
}

function compactLines(value: string): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

function firstLine(...values: string[]): string {
  for (const value of values) {
    const [line] = compactLines(value);
    if (line) return line;
  }
  return 'Review the generated plan before implementation starts.';
}

function fallbackItems(items: string[], fallback: string): string[] {
  return items.length > 0 ? items : [fallback];
}

export function buildPlanReviewBrief({
  topicDir,
  request,
  resolvedContext,
  readinessAssessment,
  specContent,
  implementationPlanContent,
  executionHandoff,
  worktree,
  now = new Date(),
}: {
  topicDir: string;
  request: string;
  resolvedContext: { matches?: Array<{ label?: string }> };
  readinessAssessment: ShiftAxPlanningReadinessAssessment;
  specContent: string;
  implementationPlanContent: string;
  executionHandoff: ShiftAxExecutionHandoff;
  worktree: TopicWorktreeCreateResult;
  now?: Date;
}): ShiftAxPlanReviewBrief {
  const specSections = parseMarkdownSections(specContent);
  const planSections = parseMarkdownSections(implementationPlanContent);
  const matchedContext = (resolvedContext.matches ?? [])
    .map((match) => match.label)
    .filter((label): label is string => Boolean(label));

  return {
    version: 1,
    status: 'requires_human_review',
    generated_at: now.toISOString(),
    topic_dir: topicDir,
    worktree_path: worktree.worktree_path,
    request: request.trim(),
    goal: firstLine(readPlanSection(specSections, 'Goal'), request),
    matched_context: fallbackItems(matchedContext, 'No matched global context document was recorded.'),
    constraints: fallbackItems(
      extractMarkdownBullets(readPlanSection(specSections, 'Constraints')),
      'No explicit constraints were recorded; ask for clarification before approval.',
    ),
    out_of_scope: fallbackItems(
      extractMarkdownBullets(readPlanSection(specSections, 'Out of Scope')),
      'No explicit out-of-scope boundary was recorded; ask for clarification before approval.',
    ),
    acceptance_criteria: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Acceptance Criteria')),
      'No acceptance criteria were recorded; do not approve yet.',
    ),
    likely_files_touched: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Likely Files Touched')),
      'No likely files were recorded; do not approve broad implementation.',
    ),
    verification_commands: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Verification Commands')),
      'No verification command was recorded; do not approve yet.',
    ),
    execution_tasks: executionHandoff.tasks.map((task) => ({
      id: task.id,
      summary: task.source_text,
      execution_mode: task.execution_mode,
    })),
    readiness: {
      status: readinessAssessment.status,
      ambiguity_score: readinessAssessment.ambiguity_score,
      ambiguity_threshold: readinessAssessment.ambiguity_threshold,
      blockers: readinessAssessment.blockers,
    },
    review_prompt:
      'Reply with 1 to approve and start implementation, 2 to request plan changes, or 3 to reject this request. The assistant handles the internal approval and resume commands.',
    response_options: [
      {
        value: '1',
        label: 'Approve and start implementation',
        action: 'approve_and_continue',
        assistant_behavior: 'Record approval internally, then resume implementation automatically.',
      },
      {
        value: '2',
        label: 'Request plan changes',
        action: 'request_changes',
        assistant_behavior: 'Capture the requested changes, update the planning artifacts, and present the revised review brief.',
      },
      {
        value: '3',
        label: 'Reject this request',
        action: 'reject',
        assistant_behavior: 'Record the rejection internally and stop the request flow.',
      },
    ],
  };
}

export function renderPlanReviewBriefMarkdown(brief: ShiftAxPlanReviewBrief): string {
  return [
    '# Plan Review Brief',
    '',
    `- Topic: ${brief.topic_dir}`,
    `- Worktree: ${brief.worktree_path}`,
    `- Readiness: ${brief.readiness.status} (ambiguity ${brief.readiness.ambiguity_score}/${brief.readiness.ambiguity_threshold})`,
    '',
    '## Goal',
    '',
    brief.goal,
    '',
    '## Matched Context',
    '',
    ...brief.matched_context.map((item) => `- ${item}`),
    '',
    '## Constraints',
    '',
    ...brief.constraints.map((item) => `- ${item}`),
    '',
    '## Out Of Scope',
    '',
    ...brief.out_of_scope.map((item) => `- ${item}`),
    '',
    '## Acceptance Criteria',
    '',
    ...brief.acceptance_criteria.map((item) => `- ${item}`),
    '',
    '## Likely Files Touched',
    '',
    ...brief.likely_files_touched.map((item) => `- ${item}`),
    '',
    '## Verification Commands',
    '',
    ...brief.verification_commands.map((item) => `- ${item}`),
    '',
    '## Execution Tasks',
    '',
    ...(brief.execution_tasks.length > 0
      ? brief.execution_tasks.map((task) => `- ${task.id} (${task.execution_mode}): ${task.summary}`)
      : ['- No execution task was recorded; request plan changes before approval.']),
    '',
    '## Readiness Blockers',
    '',
    ...(brief.readiness.blockers.length > 0
      ? brief.readiness.blockers.map((blocker) => `- ${blocker}`)
      : ['- None.']),
    '',
    '## Required Human Response',
    '',
    brief.review_prompt,
    '',
    '## Response Options',
    '',
    ...brief.response_options.map(
      (option) => `- ${option.value}. ${option.label}: ${option.assistant_behavior}`,
    ),
    '',
  ].join('\n');
}

export async function writePlanReviewBrief(
  topicDir: string,
  brief: ShiftAxPlanReviewBrief,
): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'plan_review_brief'),
    `${renderPlanReviewBriefMarkdown(brief)}\n`,
    'utf8',
  );
}
