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
  | 'run-request'
  | 'approve-plan'
  | 'finalize-commit';
export type ShiftAxWorktreeSupport = 'planned' | 'available';
export type ShiftAxTmuxRuntimeSupport = 'planned' | 'imported-helpers';

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

export interface ShiftAxPlatformManifest {
  platform: ShiftAxPlatform;
  integration_mode: ShiftAxIntegrationMode;
  natural_language_first: true;
  worktree_support: ShiftAxWorktreeSupport;
  worktree_runtime: ShiftAxPlatformWorktreeRuntime;
  tmux_runtime: ShiftAxPlatformTmuxRuntime;
  default_base_context_index: string;
  default_topic_root: string;
  core_commands: ShiftAxCoreCommand[];
}

export interface ShiftAxPlatformAdapter {
  platform: ShiftAxPlatform;
  getManifest(rootDir: string): ShiftAxPlatformManifest;
  renderBootstrapInstructions(rootDir: string): string;
  commandFor(command: ShiftAxCoreCommand): string[];
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
