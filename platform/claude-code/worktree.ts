import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ShiftAxPlatformWorktreeRuntime } from '../../adapters/contracts.js';
import {
  planTopicWorktree,
  recordTopicWorktreeCreate,
  recordTopicWorktreeRemove,
  resolveTopicWorktreeTarget,
  type TopicWorktreeCreateInput,
  type TopicWorktreeCreateResult,
  type TopicWorktreePlanInput,
  type TopicWorktreeRemoveInput,
  type TopicWorktreeRemoveResult,
} from '../../core/topics/worktree-runtime.js';
import type { ShiftAxWorktreePlan } from '../../core/topics/worktree.js';
import { readImportedUpstreamSlice } from '../upstream-imports.js';
import {
  createClaudeManagedWorktree,
  removeClaudeManagedWorktree,
} from './upstream/worktree/imported/managed-worktree.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function command(name: 'worktree-plan' | 'worktree-create' | 'worktree-remove'): string[] {
  return ['ax', name];
}

export function getClaudeCodeWorktreeRuntime(
  rootDir: string,
): ShiftAxPlatformWorktreeRuntime {
  const importRoot = join(rootDir, 'platform', 'claude-code', 'upstream', 'worktree');

  return {
    support: 'available',
    entrypoint_style: 'cli',
    topic_artifacts: {
      plan: 'worktree-plan.json',
      state: 'worktree-state.json',
    },
    operations: {
      plan: {
        command: command('worktree-plan'),
        topic_flag: '--topic',
      },
      create: {
        command: command('worktree-create'),
        topic_flag: '--topic',
        additional_flags: ['--base'],
      },
      remove: {
        command: command('worktree-remove'),
        topic_flag: '--topic',
      },
    },
    upstream_boundary: {
      import_root: importRoot,
      provenance_doc: join(
        rootDir,
        'platform',
        'claude-code',
        'upstream',
        'worktree',
        'provenance.md',
      ),
      planned_upstream_modules: [
        'oh-my-claudecode/src/team/git-worktree.ts',
        'oh-my-claudecode/src/lib/worktree-paths.ts',
      ],
      active_imports: [
        readImportedUpstreamSlice(join(HERE, 'upstream', 'worktree', 'imported', 'provenance.json')),
        readImportedUpstreamSlice(
          join(HERE, 'upstream', 'worktree', 'imported', 'managed-worktree.provenance.json'),
        ),
      ],
    },
  };
}

export async function planClaudeCodeTopicWorktree(
  input: TopicWorktreePlanInput,
): Promise<ShiftAxWorktreePlan> {
  return planTopicWorktree(input);
}

export async function createClaudeCodeTopicWorktree(
  input: TopicWorktreeCreateInput,
): Promise<TopicWorktreeCreateResult> {
  const target = await resolveTopicWorktreeTarget(input);

  if (existsSync(target.worktreePath)) {
    return recordTopicWorktreeCreate(target, {
      created: false,
      reused: true,
    });
  }

  createClaudeManagedWorktree({
    repoRoot: target.rootDir,
    worktreePath: target.worktreePath,
    branchName: target.branchName,
    baseBranch: target.baseBranch,
  });

  return recordTopicWorktreeCreate(target, {
    created: true,
    reused: false,
  });
}

export async function removeClaudeCodeTopicWorktree(
  input: TopicWorktreeRemoveInput,
): Promise<TopicWorktreeRemoveResult> {
  const target = await resolveTopicWorktreeTarget(input);

  removeClaudeManagedWorktree({
    repoRoot: target.rootDir,
    worktreePath: target.worktreePath,
    branchName: target.branchName,
  });

  return recordTopicWorktreeRemove(target, !existsSync(target.worktreePath));
}
