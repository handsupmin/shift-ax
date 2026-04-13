import { readFile, writeFile } from 'node:fs/promises';

import { topicArtifactPath } from '../topics/topic-artifacts.js';

export const SHIFT_AX_ESCALATION_KINDS = [
  'new-user-flow',
  'policy-conflict',
  'risky-data-or-permission-change',
] as const;

export type ShiftAxWorkflowEscalationKind =
  (typeof SHIFT_AX_ESCALATION_KINDS)[number];

export type ShiftAxWorkflowPhase =
  | 'bootstrapped'
  | 'context_resolved'
  | 'brainstorming'
  | 'plan_ready'
  | 'awaiting_plan_review'
  | 'awaiting_policy_sync'
  | 'awaiting_human_escalation'
  | 'approved'
  | 'implementation_running'
  | 'review_pending'
  | 'commit_ready'
  | 'committed';

export interface ShiftAxWorkflowVerification {
  command: string;
  source?: 'local' | 'ci';
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface ShiftAxWorkflowEscalation {
  kind: ShiftAxWorkflowEscalationKind;
  summary: string;
  detected_at: string;
  resolved_at?: string;
  resolution?: string;
}

export interface ShiftAxWorkflowEscalationState {
  status: 'clear' | 'required';
  triggers: ShiftAxWorkflowEscalation[];
}

export interface ShiftAxWorkflowState {
  version: 1;
  topic_slug: string;
  phase: ShiftAxWorkflowPhase;
  created_at: string;
  updated_at: string;
  plan_review_status: 'pending' | 'approved' | 'changes_requested';
  worktree?: {
    branch_name?: string;
    worktree_path?: string;
    base_branch?: string;
  };
  resolved_context?: {
    index_path: string;
    query: string;
    matches: number;
    unresolved_paths: string[];
  };
  review?: {
    overall_status: 'approved' | 'changes_requested' | 'blocked';
    commit_allowed: boolean;
    next_stage: 'finalization' | 'implementation';
  };
  verification?: ShiftAxWorkflowVerification[];
  escalation?: ShiftAxWorkflowEscalationState;
}

export function hasActiveWorkflowEscalations(
  state: ShiftAxWorkflowState,
): boolean {
  return (
    state.escalation?.status === 'required' &&
    state.escalation.triggers.some((trigger) => !trigger.resolved_at)
  );
}

export async function readWorkflowState(
  topicDir: string,
): Promise<ShiftAxWorkflowState> {
  const raw = await readFile(topicArtifactPath(topicDir, 'workflow_state'), 'utf8');
  return JSON.parse(raw) as ShiftAxWorkflowState;
}

export async function writeWorkflowState(
  topicDir: string,
  state: ShiftAxWorkflowState,
): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'workflow_state'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}
