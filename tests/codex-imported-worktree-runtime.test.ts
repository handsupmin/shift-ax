import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  ensureCodexManagedWorktree,
  removeCodexManagedWorktree,
} from '../platform/codex/upstream/worktree/imported/managed-worktree.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-codex-imported-worktree-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('ensureCodexManagedWorktree creates and reuses a named branch worktree', async () => {
  const repoRoot = await createGitRepo();

  try {
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    const created = ensureCodexManagedWorktree({
      repoRoot,
      worktreePath: join(repoRoot, '.ax', 'codex-imported', 'worker-a'),
      branchName: 'ax/imported-worker-a',
      baseRef,
    });

    assert.equal(created.created, true);
    assert.equal(created.reused, false);
    assert.equal(created.createdBranch, true);
    assert.equal(existsSync(created.worktreePath), true);

    const reused = ensureCodexManagedWorktree({
      repoRoot,
      worktreePath: created.worktreePath,
      branchName: 'ax/imported-worker-a',
      baseRef,
    });

    assert.equal(reused.created, false);
    assert.equal(reused.reused, true);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('ensureCodexManagedWorktree rejects dirty existing worktrees', async () => {
  const repoRoot = await createGitRepo();

  try {
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    const created = ensureCodexManagedWorktree({
      repoRoot,
      worktreePath: join(repoRoot, '.ax', 'codex-imported', 'worker-b'),
      branchName: 'ax/imported-worker-b',
      baseRef,
    });

    await writeFile(join(created.worktreePath, 'DIRTY.txt'), 'dirty\n', 'utf8');

    assert.throws(
      () =>
        ensureCodexManagedWorktree({
          repoRoot,
          worktreePath: created.worktreePath,
          branchName: 'ax/imported-worker-b',
          baseRef,
        }),
      /worktree_dirty/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('removeCodexManagedWorktree removes the worktree path and branch', async () => {
  const repoRoot = await createGitRepo();

  try {
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    const created = ensureCodexManagedWorktree({
      repoRoot,
      worktreePath: join(repoRoot, '.ax', 'codex-imported', 'worker-c'),
      branchName: 'ax/imported-worker-c',
      baseRef,
    });
    assert.equal(existsSync(created.worktreePath), true);

    await removeCodexManagedWorktree(created);

    assert.equal(existsSync(created.worktreePath), false);

    const branches = execFileSync('git', ['branch'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.doesNotMatch(branches, /ax\/imported-worker-c/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
