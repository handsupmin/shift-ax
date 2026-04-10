import type {
  ShiftAxCoreCommand,
  ShiftAxPlatformAdapter,
  ShiftAxPlatformManifest,
} from '../contracts.js';
import { defaultBaseContextIndex, defaultTopicRoot } from '../contracts.js';
import {
  getCodexExecutionRuntime,
  launchCodexExecution,
  planCodexExecutionLaunch,
} from '../../platform/codex/execution.js';
import {
  createCodexTopicWorktree,
  getCodexWorktreeRuntime,
  planCodexTopicWorktree,
  removeCodexTopicWorktree,
} from '../../platform/codex/worktree.js';
import { resolveCodexRepoRoot } from '../../platform/codex/upstream/worktree/imported/resolve-repo-root.js';
import { getCodexTmuxRuntime as getCodexTmuxRuntimeMetadata } from '../../platform/codex/tmux.js';

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
  'topics-status',
];

export const codexAdapter: ShiftAxPlatformAdapter = {
  platform: 'codex',

  getManifest(rootDir: string): ShiftAxPlatformManifest {
    const platformRoot = resolvePlatformRoot(rootDir);
    const worktreeRuntime = getCodexWorktreeRuntime(platformRoot);
    const tmuxRuntime = getCodexTmuxRuntimeMetadata(platformRoot);
    const executionRuntime = getCodexExecutionRuntime();

    return {
      platform: 'codex',
      integration_mode: 'agents-md-bootstrap',
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
      'Shift AX Codex Build',
      '',
      'Bootstrap mode: AGENTS.md-driven startup.',
      `Before planning or implementation, load the base-context index at ${defaultBaseContextIndex(platformRoot)} and route the request through Shift AX core flow.`,
      'If the base-context index is missing, interview the team and persist it with `shift-ax onboard-context` (interactive) or `shift-ax onboard-context --input <file>` before starting request work.',
      'Use `shift-ax doctor` for a compact repo/runtime health report when the setup or launcher state is unclear.',
      'Use `shift-ax run-request` to bootstrap the request-scoped topic/worktree, resolve context, run the planning interview, write `execution-handoff.json`, and pause at the human planning-review gate.',
      'Use `shift-ax approve-plan` to record the human planning-review decision.',
      'If the approved plan requires shared domain or policy document updates, complete them first and record that gate with `shift-ax sync-policy-context --topic <dir> --summary "<what changed>" [--path <doc>]... [--entry "Label -> path"]...` before resuming implementation.',
      'Then resume with `shift-ax run-request --topic <dir> --resume` for automatic review and commit. Add `--no-auto-commit` only when a human explicitly wants a final manual stop.',
      'If downstream review or CI fails after the topic looked ready, use `shift-ax react-feedback --topic <dir> --kind <review-changes-requested|ci-failed> --summary "<text>"` to reopen implementation with a file-backed reaction trail.',
      'Use `shift-ax launch-execution --platform codex --topic <dir> [--task-id <id>] [--dry-run]` when you need the platform-owned Codex launch commands for subagent or tmux execution from `execution-handoff.json`.',
      'Use `shift-ax topic-status --topic <dir>` for a compact summary of workflow phase, review gate, execution status, and latest failure reason.',
      'Use `shift-ax topics-status [--root DIR] [--limit N]` when you need a compact list of recent topics without opening a separate dashboard.',
      'If a reviewed request hits a mandatory escalation trigger, persist that stop with `shift-ax run-request --topic <dir> --resume --escalation <kind>:<summary>` and resume only after human review with `--clear-escalations`.',
      'Use `shift-ax finalize-commit` after `shift-ax review --run` reports commit-ready status.',
      'Use `shift-ax worktree-plan` to inspect the preferred branch and worktree path for a topic.',
      'Use `shift-ax worktree-create` before implementation begins, and `shift-ax worktree-remove` when the topic worktree should be torn down.',
      'Natural language is the primary user surface. Internal AX commands exist for tooling and debugging, but the default user experience should remain conversational.',
    ].join('\n');
  },

  commandFor(command: ShiftAxCoreCommand): string[] {
    return ['shift-ax', command];
  },

  async planExecution(input) {
    return planCodexExecutionLaunch(input);
  },

  async launchExecution(input) {
    return launchCodexExecution(input);
  },

  async planWorktree(input) {
    return planCodexTopicWorktree(input);
  },

  async createWorktree(input) {
    return createCodexTopicWorktree(input);
  },

  async removeWorktree(input) {
    return removeCodexTopicWorktree(input);
  },
};

function resolvePlatformRoot(rootDir: string): string {
  try {
    return resolveCodexRepoRoot(rootDir);
  } catch {
    return rootDir;
  }
}
