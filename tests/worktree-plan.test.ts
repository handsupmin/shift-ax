import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

import { bootstrapTopic } from '../core/topics/bootstrap.js';
import { buildWorktreePlan } from '../core/topics/worktree.js';

test('buildWorktreePlan derives branch and path from topic slug', () => {
  const plan = buildWorktreePlan({
    rootDir: '/repo',
    topicSlug: '2026-04-06-auth-refresh',
    request: 'Build auth refresh flow',
  });

  assert.equal(plan.preferred_branch_name, 'ax/2026-04-06-auth-refresh');
  assert.equal(
    plan.preferred_worktree_path,
    '/repo/.ax/worktrees/2026-04-06-auth-refresh',
  );
});

test('ax worktree-plan updates worktree-plan.json for a topic', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-worktree-plan-'));

  try {
    const bootstrap = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
      summary: 'Bootstrap a topic',
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'worktree-plan', '--topic', bootstrap.topicDir],
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
        else reject(new Error(error || `ax worktree-plan exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as {
      topic_slug: string;
      preferred_branch_name: string;
      preferred_worktree_path: string;
    };
    const file = JSON.parse(
      await readFile(join(bootstrap.topicDir, 'worktree-plan.json'), 'utf8'),
    ) as {
      topic_slug: string;
      preferred_branch_name: string;
      preferred_worktree_path: string;
    };

    assert.equal(result.topic_slug, bootstrap.topicSlug);
    assert.equal(file.topic_slug, bootstrap.topicSlug);
    assert.equal(result.preferred_branch_name, `ax/${bootstrap.topicSlug}`);
    assert.match(result.preferred_worktree_path, /\.ax\/worktrees\//);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
