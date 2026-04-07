import { execSync } from 'node:child_process';

/**
 * Imported from oh-my-claudecode.
 * Source: oh-my-claudecode/src/lib/worktree-paths.ts
 * Commit: 2487d3878f8d25e60802940b020d5ee8774d135e
 */

const MAX_WORKTREE_CACHE_SIZE = 8;
const worktreeCacheMap = new Map<string, string>();

export function clearClaudeCodeWorktreeRootCache(): void {
  worktreeCacheMap.clear();
}

export function getClaudeCodeWorktreeRoot(cwd?: string): string | null {
  const effectiveCwd = cwd || process.cwd();

  if (worktreeCacheMap.has(effectiveCwd)) {
    const root = worktreeCacheMap.get(effectiveCwd)!;
    worktreeCacheMap.delete(effectiveCwd);
    worktreeCacheMap.set(effectiveCwd, root);
    return root || null;
  }

  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: effectiveCwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).trim();

    if (worktreeCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
      const oldest = worktreeCacheMap.keys().next().value;
      if (oldest !== undefined) {
        worktreeCacheMap.delete(oldest);
      }
    }

    worktreeCacheMap.set(effectiveCwd, root);
    return root;
  } catch {
    return null;
  }
}
