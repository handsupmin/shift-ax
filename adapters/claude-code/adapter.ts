import type {
  ShiftAxCoreCommand,
  ShiftAxPlatformAdapter,
  ShiftAxPlatformManifest,
} from '../contracts.js';
import { defaultBaseContextIndex, defaultTopicRoot } from '../contracts.js';
import {
  getClaudeCodeExecutionRuntime,
  launchClaudeCodeExecution,
  planClaudeCodeExecutionLaunch,
} from '../../platform/claude-code/execution.js';
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
  'doctor',
  'run-request',
  'approve-plan',
  'sync-policy-context',
  'react-feedback',
  'finalize-commit',
  'launch-execution',
  'topic-status',
];

export const claudeCodeAdapter: ShiftAxPlatformAdapter = {
  platform: 'claude-code',

  getManifest(rootDir: string): ShiftAxPlatformManifest {
    const platformRoot = resolvePlatformRoot(rootDir);
    const worktreeRuntime = getClaudeCodeWorktreeRuntime(platformRoot);
    const tmuxRuntime = getClaudeCodeTmuxRuntime(platformRoot);
    const executionRuntime = getClaudeCodeExecutionRuntime();

    return {
      platform: 'claude-code',
      integration_mode: 'hook-bootstrap',
      natural_language_first: true,
      worktree_support: worktreeRuntime.support,
      worktree_runtime: worktreeRuntime,
      tmux_runtime: tmuxRuntime,
      execution_runtime: executionRuntime,
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
      'Use `ax doctor` for a compact repo/runtime health report when the setup or launcher state is unclear.',
      'Use `ax run-request` to bootstrap the request-scoped topic/worktree, resolve context, run the planning interview, write `execution-handoff.json`, and pause at the human planning-review gate.',
      'Use `ax approve-plan` to record the human planning-review decision.',
      'If the approved plan requires shared domain or policy document updates, complete them first and record that gate with `ax sync-policy-context --topic <dir> --summary "<what changed>" [--path <doc>]... [--entry "Label -> path"]...` before resuming implementation.',
      'Then resume with `ax run-request --topic <dir> --resume` for automatic review and commit. Add `--no-auto-commit` only when a human explicitly wants a final manual stop.',
      'If downstream review or CI fails after the topic looked ready, use `ax react-feedback --topic <dir> --kind <review-changes-requested|ci-failed> --summary "<text>"` to reopen implementation with a file-backed reaction trail.',
      'Use `ax launch-execution --platform claude-code --topic <dir> [--task-id <id>] [--dry-run]` when you need the platform-owned Claude launch commands for subagent or tmux execution from `execution-handoff.json`.',
      'Use `ax topic-status --topic <dir>` for a compact summary of workflow phase, review gate, execution status, and latest failure reason.',
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

  async planExecution(input) {
    return planClaudeCodeExecutionLaunch(input);
  },

  async launchExecution(input) {
    return launchClaudeCodeExecution(input);
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
