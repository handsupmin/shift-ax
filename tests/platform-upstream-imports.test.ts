import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  resolveCodexRepoRoot,
} from '../platform/codex/upstream/worktree/imported/resolve-repo-root.js';
import {
  clearClaudeCodeWorktreeRootCache,
  getClaudeCodeWorktreeRoot,
} from '../platform/claude-code/upstream/worktree/imported/get-worktree-root.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-upstream-import-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await mkdir(join(root, 'packages', 'app'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  execFileSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('codex imported resolveRepoRoot helper resolves the git toplevel', async () => {
  const repoRoot = await createGitRepo();

  try {
    const nested = join(repoRoot, 'packages', 'app');
    const canonicalRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: nested,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    assert.equal(resolveCodexRepoRoot(nested), canonicalRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('claude-code imported getWorktreeRoot helper resolves the git toplevel', async () => {
  const repoRoot = await createGitRepo();

  try {
    clearClaudeCodeWorktreeRootCache();
    const nested = join(repoRoot, 'packages', 'app');
    const canonicalRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: nested,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    assert.equal(getClaudeCodeWorktreeRoot(nested), canonicalRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('imported provenance metadata pins upstream source commits and files', async () => {
  const codexRaw = await readFile(
    new URL('../platform/codex/upstream/worktree/imported/provenance.json', import.meta.url),
    'utf8',
  );
  const codexManagedRaw = await readFile(
    new URL(
      '../platform/codex/upstream/worktree/imported/managed-worktree.provenance.json',
      import.meta.url,
    ),
    'utf8',
  );
  const claudeRaw = await readFile(
    new URL('../platform/claude-code/upstream/worktree/imported/provenance.json', import.meta.url),
    'utf8',
  );
  const claudeManagedRaw = await readFile(
    new URL(
      '../platform/claude-code/upstream/worktree/imported/managed-worktree.provenance.json',
      import.meta.url,
    ),
    'utf8',
  );

  const codex = JSON.parse(codexRaw) as {
    source_commit: string;
    source_file: string;
  };
  const codexManaged = JSON.parse(codexManagedRaw) as {
    source_commit: string;
    source_file: string;
  };
  const claude = JSON.parse(claudeRaw) as {
    source_commit: string;
    source_file: string;
  };
  const claudeManaged = JSON.parse(claudeManagedRaw) as {
    source_commit: string;
    source_file: string;
  };

  assert.equal(codex.source_commit, 'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee');
  assert.equal(codex.source_file, 'src/cli/autoresearch.ts');
  assert.equal(codexManaged.source_commit, 'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee');
  assert.equal(codexManaged.source_file, 'src/team/worktree.ts');
  assert.equal(claude.source_commit, '2487d3878f8d25e60802940b020d5ee8774d135e');
  assert.equal(claude.source_file, 'src/lib/worktree-paths.ts');
  assert.equal(claudeManaged.source_commit, '2487d3878f8d25e60802940b020d5ee8774d135e');
  assert.equal(claudeManaged.source_file, 'src/team/git-worktree.ts');
});
