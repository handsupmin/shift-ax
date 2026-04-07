import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createClaudeManagedWorktree,
  removeClaudeManagedWorktree,
} from '../platform/claude-code/upstream/worktree/imported/managed-worktree.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-claude-imported-worktree-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('createClaudeManagedWorktree creates a named branch worktree', async () => {
  const repoRoot = await createGitRepo();

  try {
    const created = createClaudeManagedWorktree({
      repoRoot,
      worktreePath: join(repoRoot, '.ax', 'claude-imported', 'worker-a'),
      branchName: 'ax/claude-imported-worker-a',
      baseBranch: 'main',
    });

    assert.equal(existsSync(created.path), true);
    assert.equal(created.branch, 'ax/claude-imported-worker-a');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('removeClaudeManagedWorktree removes the worktree path and branch', async () => {
  const repoRoot = await createGitRepo();

  try {
    const created = createClaudeManagedWorktree({
      repoRoot,
      worktreePath: join(repoRoot, '.ax', 'claude-imported', 'worker-b'),
      branchName: 'ax/claude-imported-worker-b',
      baseBranch: 'main',
    });
    assert.equal(existsSync(created.path), true);

    removeClaudeManagedWorktree({
      repoRoot,
      worktreePath: created.path,
      branchName: created.branch,
    });

    assert.equal(existsSync(created.path), false);

    const branches = execFileSync('git', ['branch'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.doesNotMatch(branches, /ax\/claude-imported-worker-b/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
