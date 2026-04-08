import { join, resolve, sep } from 'node:path';

export interface ShiftAxTopicArtifacts {
  request: string;
  request_summary: string;
  resolved_context: string;
  brainstorm: string;
  spec: string;
  plan_review: string;
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

export type ShiftAxTopicArtifactKey = keyof ShiftAxTopicArtifacts;

export function defaultTopicArtifacts(): ShiftAxTopicArtifacts {
  return {
    request: 'request.md',
    request_summary: 'request-summary.md',
    resolved_context: 'resolved-context.json',
    brainstorm: 'brainstorm.md',
    spec: 'spec.md',
    plan_review: 'plan-review.json',
    implementation_plan: 'implementation-plan.md',
    execution_handoff: 'execution-handoff.json',
    execution_state: 'execution-state.json',
    workflow_state: 'workflow-state.json',
    review_dir: 'review',
    final_dir: 'final',
    commit_message: 'final/commit-message.md',
    commit_state: 'final/commit-state.json',
    verification: 'final/verification.md',
    worktree_plan: 'worktree-plan.json',
    worktree_state: 'worktree-state.json',
  };
}

export function topicArtifactPath(
  topicDir: string,
  key: ShiftAxTopicArtifactKey,
): string {
  return join(topicDir, defaultTopicArtifacts()[key]);
}

export function getRootDirFromTopicDir(topicDir: string): string {
  const resolved = resolve(topicDir);
  const marker = `${sep}.ax${sep}topics${sep}`;
  const index = resolved.lastIndexOf(marker);
  if (index === -1) {
    throw new Error(`topicDir is not inside .ax/topics: ${topicDir}`);
  }
  return resolved.slice(0, index);
}
