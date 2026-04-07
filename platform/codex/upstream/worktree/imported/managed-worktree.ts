import { execFile as execFileCb, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFilePromise = promisify(execFileCb);
const BRANCH_IN_USE_PATTERN = /already checked out|already used by worktree|is already checked out/i;

/**
 * Imported from oh-my-codex.
 * Source: oh-my-codex/src/team/worktree.ts
 * Commit: fabb3ce0b96e42c20feb2940c74f2aa5addb8cee
 */

export interface CodexManagedWorktreePlan {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
  baseRef: string;
}

export interface CodexManagedWorktreeResult {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
  created: boolean;
  reused: boolean;
  createdBranch: boolean;
}

interface GitWorktreeEntry {
  path: string;
  head: string;
  branchRef: string | null;
  detached: boolean;
}

function readGit(repoRoot: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.status === 0) {
    return (result.stdout || '').trim();
  }

  const stderr = (result.stderr || '').trim();
  throw new Error(stderr || `git ${args.join(' ')} failed`);
}

function branchExists(repoRoot: string, branchName: string): boolean {
  const result = spawnSync(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
    {
      cwd: repoRoot,
      encoding: 'utf-8',
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function isWorktreeDirty(worktreePath: string): boolean {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: worktreePath,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(stderr || `worktree_status_failed:${worktreePath}`);
  }
  return (result.stdout || '').trim() !== '';
}

function listWorktrees(repoRoot: string): GitWorktreeEntry[] {
  const raw = readGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (!raw) return [];

  return raw
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const worktreeLine = lines.find((line) => line.startsWith('worktree '));
      const headLine = lines.find((line) => line.startsWith('HEAD '));
      const branchLine = lines.find((line) => line.startsWith('branch '));
      if (!worktreeLine || !headLine) return null;

      return {
        path: resolve(worktreeLine.slice('worktree '.length)),
        head: headLine.slice('HEAD '.length).trim(),
        branchRef: branchLine ? branchLine.slice('branch '.length).trim() : null,
        detached: lines.includes('detached') || !branchLine,
      };
    })
    .filter((entry): entry is GitWorktreeEntry => Boolean(entry));
}

function findWorktreeByPath(
  entries: GitWorktreeEntry[],
  worktreePath: string,
): GitWorktreeEntry | null {
  const resolvedPath = canonicalizePath(worktreePath);
  return entries.find((entry) => canonicalizePath(entry.path) === resolvedPath) || null;
}

function hasBranchInUse(
  entries: GitWorktreeEntry[],
  branchName: string,
  worktreePath: string,
): boolean {
  const expectedRef = `refs/heads/${branchName}`;
  const resolvedPath = canonicalizePath(worktreePath);
  return entries.some(
    (entry) => entry.branchRef === expectedRef && canonicalizePath(entry.path) !== resolvedPath,
  );
}

function resolveGitCommonDir(cwd: string): string | null {
  const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  const value = (result.stdout || '').trim();
  return value ? resolve(cwd, value) : null;
}

function readWorktreeEntryFromPath(
  repoRoot: string,
  worktreePath: string,
): GitWorktreeEntry | null {
  if (!existsSync(worktreePath)) return null;

  const repoCommonDir = resolveGitCommonDir(repoRoot);
  const worktreeCommonDir = resolveGitCommonDir(worktreePath);
  if (!repoCommonDir || !worktreeCommonDir || repoCommonDir !== worktreeCommonDir) {
    return null;
  }

  const headResult = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (headResult.status !== 0) return null;
  const head = (headResult.stdout || '').trim();
  if (!head) return null;

  const branchResult = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], {
    cwd: worktreePath,
    encoding: 'utf-8',
    windowsHide: true,
  });
  const branchRef = branchResult.status === 0 ? (branchResult.stdout || '').trim() : null;

  return {
    path: canonicalizePath(worktreePath),
    head,
    branchRef: branchRef || null,
    detached: !branchRef,
  };
}

function canonicalizePath(path: string): string {
  if (existsSync(path)) {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  }
  return resolve(path);
}

export function ensureCodexManagedWorktree(
  plan: CodexManagedWorktreePlan,
): CodexManagedWorktreeResult {
  const allWorktrees = listWorktrees(plan.repoRoot);
  const existingAtPath =
    findWorktreeByPath(allWorktrees, plan.worktreePath) ??
    readWorktreeEntryFromPath(plan.repoRoot, plan.worktreePath);
  const expectedBranchRef = `refs/heads/${plan.branchName}`;

  if (existingAtPath) {
    if (existingAtPath.branchRef !== expectedBranchRef) {
      throw new Error(`worktree_target_mismatch:${plan.worktreePath}`);
    }

    if (isWorktreeDirty(plan.worktreePath)) {
      throw new Error(`worktree_dirty:${plan.worktreePath}`);
    }

    return {
      repoRoot: plan.repoRoot,
      worktreePath: canonicalizePath(plan.worktreePath),
      branchName: plan.branchName,
      created: false,
      reused: true,
      createdBranch: false,
    };
  }

  if (existsSync(plan.worktreePath)) {
    throw new Error(`worktree_path_conflict:${plan.worktreePath}`);
  }

  if (hasBranchInUse(allWorktrees, plan.branchName, plan.worktreePath)) {
    throw new Error(`branch_in_use:${plan.branchName}`);
  }

  mkdirSync(dirname(plan.worktreePath), { recursive: true });
  const branchAlreadyExisted = branchExists(plan.repoRoot, plan.branchName);
  const addArgs = branchAlreadyExisted
    ? ['worktree', 'add', plan.worktreePath, plan.branchName]
    : ['worktree', 'add', '-b', plan.branchName, plan.worktreePath, plan.baseRef];

  const result = spawnSync('git', addArgs, {
    cwd: plan.repoRoot,
    encoding: 'utf-8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    if (BRANCH_IN_USE_PATTERN.test(stderr)) {
      throw new Error(`branch_in_use:${plan.branchName}`);
    }
    throw new Error(stderr || `worktree_add_failed:${addArgs.join(' ')}`);
  }

  return {
    repoRoot: plan.repoRoot,
    worktreePath: canonicalizePath(plan.worktreePath),
    branchName: plan.branchName,
    created: true,
    reused: false,
    createdBranch: !branchAlreadyExisted,
  };
}

export async function removeCodexManagedWorktree(
  result: CodexManagedWorktreeResult,
): Promise<void> {
  await execFilePromise('git', ['worktree', 'remove', '--force', result.worktreePath], {
    cwd: result.repoRoot,
    encoding: 'utf-8',
  });

  const entriesAfterRemove = listWorktrees(result.repoRoot);
  const stillCheckedOut = hasBranchInUse(
    entriesAfterRemove,
    result.branchName,
    result.worktreePath,
  );
  if (stillCheckedOut) {
    return;
  }

  try {
    await execFilePromise('git', ['branch', '-D', result.branchName], {
      cwd: result.repoRoot,
      encoding: 'utf-8',
    });
  } catch (error) {
    if (branchExists(result.repoRoot, result.branchName)) {
      const err = error as NodeJS.ErrnoException & { stderr?: string | Buffer };
      const stderr =
        typeof err.stderr === 'string'
          ? err.stderr.trim()
          : err.stderr instanceof Buffer
            ? err.stderr.toString('utf-8').trim()
            : '';
      throw new Error(stderr || `delete_branch:${result.branchName}`);
    }
  }
}
