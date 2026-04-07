import type {
  ShiftAxCoreCommand,
  ShiftAxPlatformAdapter,
  ShiftAxPlatformManifest,
} from '../contracts.js';
import { defaultBaseContextIndex, defaultTopicRoot } from '../contracts.js';
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
  'run-request',
  'approve-plan',
  'finalize-commit',
];

export const codexAdapter: ShiftAxPlatformAdapter = {
  platform: 'codex',

  getManifest(rootDir: string): ShiftAxPlatformManifest {
    const platformRoot = resolvePlatformRoot(rootDir);
    const worktreeRuntime = getCodexWorktreeRuntime(platformRoot);
    const tmuxRuntime = getCodexTmuxRuntimeMetadata(platformRoot);

    return {
      platform: 'codex',
      integration_mode: 'agents-md-bootstrap',
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
      'Shift AX Codex Build',
      '',
      'Bootstrap mode: AGENTS.md-driven startup.',
      `Before planning or implementation, load the base-context index at ${defaultBaseContextIndex(platformRoot)} and route the request through Shift AX core flow.`,
      'If the base-context index is missing, interview the team and persist it with `ax onboard-context` (interactive) or `ax onboard-context --input <file>` before starting request work.',
      'Use `ax run-request` to bootstrap the request-scoped topic/worktree, resolve context, run the planning interview, write `execution-handoff.json`, and pause at the human planning-review gate.',
      'Use `ax approve-plan` to record the human planning-review decision, then resume with `ax run-request --topic <dir> --resume` for automatic review and commit. Add `--no-auto-commit` only when a human explicitly wants a final manual stop.',
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
