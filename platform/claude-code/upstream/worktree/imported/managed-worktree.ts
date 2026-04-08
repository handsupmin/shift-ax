import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Imported from oh-my-claudecode.
 * Source: oh-my-claudecode/src/team/git-worktree.ts
 * Commit: 2487d3878f8d25e60802940b020d5ee8774d135e
 */

export interface ClaudeManagedWorktreePlan {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
  baseBranch?: string;
}

export interface ClaudeManagedWorktreeInfo {
  path: string;
  branch: string;
  createdAt: string;
}

export interface ClaudeManagedWorktreeTarget {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
}

export function createClaudeManagedWorktree(
  plan: ClaudeManagedWorktreePlan,
): ClaudeManagedWorktreeInfo {
  try {
    execFileSync('git', ['worktree', 'prune'], {
      cwd: plan.repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // best effort only
  }

  if (existsSync(plan.worktreePath)) {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', plan.worktreePath], {
        cwd: plan.repoRoot,
        stdio: 'pipe',
      });
    } catch {
      // best effort only
    }
  }

  try {
    execFileSync('git', ['branch', '-D', plan.branchName], {
      cwd: plan.repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // branch may not exist
  }

  mkdirSync(dirname(plan.worktreePath), { recursive: true });

  const args = ['worktree', 'add', '-b', plan.branchName, plan.worktreePath];
  if (plan.baseBranch) {
    args.push(plan.baseBranch);
  }

  execFileSync('git', args, {
    cwd: plan.repoRoot,
    stdio: 'pipe',
  });

  return {
    path: plan.worktreePath,
    branch: plan.branchName,
    createdAt: new Date().toISOString(),
  };
}

export function removeClaudeManagedWorktree(
  target: ClaudeManagedWorktreeTarget,
): void {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', target.worktreePath], {
      cwd: target.repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // worktree may already be absent
  }

  try {
    execFileSync('git', ['worktree', 'prune'], {
      cwd: target.repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // best effort only
  }

  try {
    execFileSync('git', ['branch', '-D', target.branchName], {
      cwd: target.repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // branch may already be absent
  }
}
