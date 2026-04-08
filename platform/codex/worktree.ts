import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
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
  ensureCodexManagedWorktree,
  removeCodexManagedWorktree,
} from './upstream/worktree/imported/managed-worktree.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function command(name: 'worktree-plan' | 'worktree-create' | 'worktree-remove'): string[] {
  return ['ax', name];
}

export function getCodexWorktreeRuntime(rootDir: string): ShiftAxPlatformWorktreeRuntime {
  const importRoot = join(rootDir, 'platform', 'codex', 'upstream', 'worktree');

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
        'codex',
        'upstream',
        'worktree',
        'provenance.md',
      ),
      planned_upstream_modules: [
        'oh-my-codex/src/team/worktree.ts',
        'oh-my-codex/src/team/state-root.ts',
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

export async function planCodexTopicWorktree(
  input: TopicWorktreePlanInput,
): Promise<ShiftAxWorktreePlan> {
  return planTopicWorktree(input);
}

export async function createCodexTopicWorktree(
  input: TopicWorktreeCreateInput,
): Promise<TopicWorktreeCreateResult> {
  const target = await resolveTopicWorktreeTarget(input);
  const baseRef = ensureBaseRef(target.rootDir, target.baseBranch);
  const result = ensureCodexManagedWorktree({
    repoRoot: target.rootDir,
    worktreePath: target.worktreePath,
    branchName: target.branchName,
    baseRef,
  });

  return recordTopicWorktreeCreate(target, {
    created: result.created,
    reused: result.reused,
  });
}

export async function removeCodexTopicWorktree(
  input: TopicWorktreeRemoveInput,
): Promise<TopicWorktreeRemoveResult> {
  const target = await resolveTopicWorktreeTarget(input);

  if (existsSync(target.worktreePath)) {
    await removeCodexManagedWorktree({
      repoRoot: target.rootDir,
      worktreePath: target.worktreePath,
      branchName: target.branchName,
      created: false,
      reused: false,
      createdBranch: true,
    });
  } else {
    try {
      execFileSync('git', ['branch', '-D', target.branchName], {
        cwd: target.rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      // Branch may already be absent.
    }
  }

  return recordTopicWorktreeRemove(target, !existsSync(target.worktreePath));
}

function ensureBaseRef(rootDir: string, baseBranch: string): string {
  return execFileSync('git', ['rev-parse', baseBranch], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
