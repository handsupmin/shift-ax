import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

import { bootstrapTopic } from '../core/topics/bootstrap.js';
import {
  createTopicWorktree,
  removeTopicWorktree,
} from '../core/topics/worktree-runtime.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('createTopicWorktree creates a git worktree from topic plan', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    const result = await createTopicWorktree({
      topicDir: bootstrap.topicDir,
      baseBranch: 'main',
    });

    assert.equal(result.created, true);
    assert.equal(result.reused, false);
    assert.equal(existsSync(result.worktree_path), true);
    assert.match(result.branch_name, /^ax\//);

    const state = JSON.parse(
      await readFile(join(bootstrap.topicDir, 'worktree-state.json'), 'utf8'),
    ) as { branch_name: string; worktree_path: string; status: string };

    assert.equal(state.status, 'created');
    assert.equal(state.branch_name, result.branch_name);
    assert.equal(state.worktree_path, result.worktree_path);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('ax worktree-create creates worktree from topic directory', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'worktree-create', '--topic', bootstrap.topicDir],
        {
          cwd: '/Users/sangmin/sources/shift-ax',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let output = '';
      let error = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(error || `ax worktree-create exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { worktree_path: string; created: boolean };
    assert.equal(result.created, true);
    assert.equal(existsSync(result.worktree_path), true);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('removeTopicWorktree removes previously created worktree and state', async () => {
  const repoRoot = await createGitRepo();

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    const created = await createTopicWorktree({
      topicDir: bootstrap.topicDir,
      baseBranch: 'main',
    });
    assert.equal(existsSync(created.worktree_path), true);

    const removed = await removeTopicWorktree({ topicDir: bootstrap.topicDir });
    assert.equal(removed.removed, true);
    assert.equal(existsSync(created.worktree_path), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
