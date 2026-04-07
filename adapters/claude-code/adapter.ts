import type {
  ShiftAxCoreCommand,
  ShiftAxPlatformAdapter,
  ShiftAxPlatformManifest,
} from '../contracts.js';
import { defaultBaseContextIndex, defaultTopicRoot } from '../contracts.js';
import {
  createClaudeCodeTopicWorktree,
  getClaudeCodeWorktreeRuntime,
  planClaudeCodeTopicWorktree,
  removeClaudeCodeTopicWorktree,
} from '../../platform/claude-code/worktree.js';
import { getClaudeCodeWorktreeRoot } from '../../platform/claude-code/upstream/worktree/imported/get-worktree-root.js';
import { getClaudeCodeTmuxRuntime } from '../../platform/claude-code/tmux.js';

const CORE_COMMANDS: ShiftAxCoreCommand[] = [
  'bootstrap-topic',
  'resolve-context',
  'review',
  'worktree-plan',
  'worktree-create',
  'worktree-remove',
  'onboard-context',
  'run-request',
  'approve-plan',
  'finalize-commit',
];

export const claudeCodeAdapter: ShiftAxPlatformAdapter = {
  platform: 'claude-code',

  getManifest(rootDir: string): ShiftAxPlatformManifest {
    const platformRoot = resolvePlatformRoot(rootDir);
    const worktreeRuntime = getClaudeCodeWorktreeRuntime(platformRoot);
    const tmuxRuntime = getClaudeCodeTmuxRuntime(platformRoot);

    return {
      platform: 'claude-code',
      integration_mode: 'hook-bootstrap',
      natural_language_first: true,
      worktree_support: worktreeRuntime.support,
      worktree_runtime: worktreeRuntime,
      tmux_runtime: tmuxRuntime,
      default_base_context_index: defaultBaseContextIndex(platformRoot),
      default_topic_root: defaultTopicRoot(platformRoot),
      core_commands: [...CORE_COMMANDS],
    };
  },

  renderBootstrapInstructions(rootDir: string): string {
    const platformRoot = resolvePlatformRoot(rootDir);

    return [
      'Shift AX Claude Code Build',
      '',
      'Bootstrap mode: hook-driven context injection.',
      'Use SessionStart and related hook surfaces to inject Shift AX startup context and guide the user into the right flow.',
      `Before planning or implementation, load the base-context index at ${defaultBaseContextIndex(platformRoot)} and route the request through Shift AX core flow.`,
      'If the base-context index is missing, interview the team and persist it with `ax onboard-context` (interactive) or `ax onboard-context --input <file>` before starting request work.',
      'Use `ax run-request` to bootstrap the request-scoped topic/worktree, resolve context, and pause at the human planning-review gate.',
      'Use `ax approve-plan` to record the human planning-review decision, then resume with `ax run-request --topic <dir> --resume`.',
      'If a reviewed request hits a mandatory escalation trigger, persist that stop with `ax run-request --topic <dir> --resume --escalation <kind>:<summary>` and resume only after human review with `--clear-escalations`.',
      'Use `ax finalize-commit` after `ax review --run` reports commit-ready status.',
      'Use `ax worktree-plan` to inspect the preferred branch and worktree path for a topic.',
      'Use `ax worktree-create` before implementation begins, and `ax worktree-remove` when the topic worktree should be torn down.',
      'Natural language is the primary user surface. Internal AX commands exist for tooling and debugging, but the default user experience should remain conversational.',
    ].join('\n');
  },

  commandFor(command: ShiftAxCoreCommand): string[] {
    return ['ax', command];
  },

  async planWorktree(input) {
    return planClaudeCodeTopicWorktree(input);
  },

  async createWorktree(input) {
    return createClaudeCodeTopicWorktree(input);
  },

  async removeWorktree(input) {
    return removeClaudeCodeTopicWorktree(input);
  },
};

function resolvePlatformRoot(rootDir: string): string {
  return getClaudeCodeWorktreeRoot(rootDir) || rootDir;
}
