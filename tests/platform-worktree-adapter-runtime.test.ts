import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getPlatformAdapter } from '../adapters/index.js';
import { bootstrapTopic } from '../core/topics/bootstrap.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-platform-worktree-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('codex adapter runs plan/create/remove worktree operations through the adapter contract', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });
    const adapter = getPlatformAdapter('codex');

    const plan = await adapter.planWorktree({ topicDir: bootstrap.topicDir });
    assert.equal(plan.topic_slug, bootstrap.topicSlug);
    assert.match(plan.preferred_worktree_path, /\.ax\/worktrees\//);

    const created = await adapter.createWorktree({
      topicDir: bootstrap.topicDir,
      baseBranch: 'main',
    });
    assert.equal(created.created, true);
    assert.equal(existsSync(created.worktree_path), true);

    const removed = await adapter.removeWorktree({ topicDir: bootstrap.topicDir });
    assert.equal(removed.removed, true);
    assert.equal(existsSync(created.worktree_path), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('claude-code adapter runs plan/create/remove worktree operations through the adapter contract', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });
    const adapter = getPlatformAdapter('claude-code');

    const plan = await adapter.planWorktree({ topicDir: bootstrap.topicDir });
    assert.equal(plan.topic_slug, bootstrap.topicSlug);
    assert.match(plan.preferred_worktree_path, /\.ax\/worktrees\//);

    const created = await adapter.createWorktree({
      topicDir: bootstrap.topicDir,
      baseBranch: 'main',
    });
    assert.equal(created.created, true);
    assert.equal(existsSync(created.worktree_path), true);

    const removed = await adapter.removeWorktree({ topicDir: bootstrap.topicDir });
    assert.equal(removed.removed, true);
    assert.equal(existsSync(created.worktree_path), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('codex adapter rejects dirty worktree reuse through imported runtime wiring', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });
    const adapter = getPlatformAdapter('codex');

    const created = await adapter.createWorktree({
      topicDir: bootstrap.topicDir,
      baseBranch: 'main',
    });
    await writeFile(join(created.worktree_path, 'DIRTY.txt'), 'dirty\n', 'utf8');

    await assert.rejects(
      () =>
        adapter.createWorktree({
          topicDir: bootstrap.topicDir,
          baseBranch: 'main',
        }),
      /worktree_dirty/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
