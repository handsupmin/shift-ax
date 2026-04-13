import { join } from 'node:path';

import type { ShiftAxWorktreePlan } from '../core/topics/worktree.js';
import type {
  TopicWorktreeCreateInput,
  TopicWorktreeCreateResult,
  TopicWorktreePlanInput,
  TopicWorktreeRemoveInput,
  TopicWorktreeRemoveResult,
} from '../core/topics/worktree-runtime.js';

export type ShiftAxPlatform = 'codex' | 'claude-code';
export type ShiftAxIntegrationMode = 'agents-md-bootstrap' | 'hook-bootstrap';
export type ShiftAxCoreCommand =
  | 'bootstrap-topic'
  | 'resolve-context'
  | 'review'
  | 'worktree-plan'
  | 'worktree-create'
  | 'worktree-remove'
  | 'onboard-context'
  | 'doctor'
  | 'run-request'
  | 'approve-plan'
  | 'sync-policy-context'
  | 'react-feedback'
  | 'finalize-commit'
  | 'launch-execution'
  | 'topic-status'
  | 'topics-status';
export type ShiftAxWorktreeSupport = 'planned' | 'available';
export type ShiftAxTmuxRuntimeSupport = 'planned' | 'imported-helpers';
export type ShiftAxExecutionRuntimeSupport = 'planned' | 'available';

export interface ShiftAxPlatformCommandEntrypoint {
  command: string[];
  topic_flag: '--topic';
  additional_flags?: string[];
}

export interface ShiftAxImportedUpstreamSlice {
  upstream_repo: string;
  source_commit: string;
  source_file: string;
  imported_symbols: string[];
}

export interface ShiftAxPlatformWorktreeRuntime {
  support: ShiftAxWorktreeSupport;
  entrypoint_style: 'cli';
  topic_artifacts: {
    plan: string;
    state: string;
  };
  operations: {
    plan: ShiftAxPlatformCommandEntrypoint;
    create: ShiftAxPlatformCommandEntrypoint;
    remove: ShiftAxPlatformCommandEntrypoint;
  };
  upstream_boundary: {
    import_root: string;
    provenance_doc: string;
    planned_upstream_modules: string[];
    active_imports: ShiftAxImportedUpstreamSlice[];
  };
}

export interface ShiftAxPlatformTmuxRuntime {
  support: ShiftAxTmuxRuntimeSupport;
  multiplexer: 'tmux';
  workspace_mode: 'leader-attached-layout' | 'detached-sessions';
  naming: {
    imported_helpers: string[];
    session_prefix?: string;
  };
  upstream_boundary: {
    import_root: string;
    provenance_doc: string;
    planned_upstream_modules: string[];
    active_imports: ShiftAxImportedUpstreamSlice[];
  };
}

export interface ShiftAxPlatformExecutionRuntime {
  support: ShiftAxExecutionRuntimeSupport;
  entrypoint_style: 'cli';
  execution_handoff_artifact: string;
  operations: {
    launch: ShiftAxPlatformCommandEntrypoint;
  };
  hosts: {
    subagent_cli: string;
    tmux_cli: 'tmux';
  };
}

export interface ShiftAxExecutionTaskPlan {
  task_id: string;
  source_text: string;
  execution_mode: 'subagent' | 'tmux';
  acceptance_criteria?: string[];
  verification_commands?: string[];
  dependencies?: string[];
  likely_files_touched?: string[];
  owner?: string;
  allowed_paths?: string[];
  parallelization_mode?: 'safe' | 'sequential' | 'coordination_required';
  conflict_flag?: string;
  contract_artifact?: string;
  warnings?: string[];
  working_directory: string;
  prompt_path: string;
  output_path: string;
  command: string[];
  shell_command: string;
  session_name?: string;
}

export interface ShiftAxExecutionLaunchInput {
  topicDir: string;
  taskId?: string;
}

export interface ShiftAxExecutionLaunchResult {
  platform: ShiftAxPlatform;
  launched: boolean;
  topic_dir: string;
  tasks: ShiftAxExecutionTaskPlan[];
}

export interface ShiftAxPlatformManifest {
  platform: ShiftAxPlatform;
  integration_mode: ShiftAxIntegrationMode;
  natural_language_first: true;
  worktree_support: ShiftAxWorktreeSupport;
  worktree_runtime: ShiftAxPlatformWorktreeRuntime;
  tmux_runtime: ShiftAxPlatformTmuxRuntime;
  execution_runtime: ShiftAxPlatformExecutionRuntime;
  default_base_context_index: string;
  default_topic_root: string;
  core_commands: ShiftAxCoreCommand[];
}

export interface ShiftAxPlatformAdapter {
  platform: ShiftAxPlatform;
  getManifest(rootDir: string): ShiftAxPlatformManifest;
  renderBootstrapInstructions(rootDir: string): string;
  commandFor(command: ShiftAxCoreCommand): string[];
  planExecution(input: ShiftAxExecutionLaunchInput): Promise<ShiftAxExecutionLaunchResult>;
  launchExecution(input: ShiftAxExecutionLaunchInput): Promise<ShiftAxExecutionLaunchResult>;
  planWorktree(input: TopicWorktreePlanInput): Promise<ShiftAxWorktreePlan>;
  createWorktree(input: TopicWorktreeCreateInput): Promise<TopicWorktreeCreateResult>;
  removeWorktree(input: TopicWorktreeRemoveInput): Promise<TopicWorktreeRemoveResult>;
}

export function defaultBaseContextIndex(rootDir: string): string {
  return join(rootDir, 'docs', 'base-context', 'index.md');
}

export function defaultTopicRoot(rootDir: string): string {
  return join(rootDir, '.ax', 'topics');
}
