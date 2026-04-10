import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getPlatformAdapter,
  listPlatformAdapters,
} from '../adapters/index.js';

test('listPlatformAdapters returns codex and claude-code adapters', () => {
  const adapters = listPlatformAdapters();
  assert.deepEqual(
    adapters.map((adapter) => adapter.platform).sort(),
    ['claude-code', 'codex'],
  );
});

test('codex adapter uses AGENTS bootstrap and core defaults', () => {
  const adapter = getPlatformAdapter('codex');
  const manifest = adapter.getManifest('/repo');

  assert.equal(manifest.platform, 'codex');
  assert.equal(manifest.integration_mode, 'agents-md-bootstrap');
  assert.equal(manifest.natural_language_first, true);
  assert.match(manifest.default_base_context_index, /docs\/base-context\/index\.md$/);
  assert.match(manifest.default_topic_root, /\.ax\/topics$/);
  assert.match(
    adapter.renderBootstrapInstructions('/repo'),
    /AGENTS\.md|bootstrap|worktree-create/i,
  );
});

test('claude-code adapter uses hook bootstrap and core defaults', () => {
  const adapter = getPlatformAdapter('claude-code');
  const manifest = adapter.getManifest('/repo');

  assert.equal(manifest.platform, 'claude-code');
  assert.equal(manifest.integration_mode, 'hook-bootstrap');
  assert.equal(manifest.natural_language_first, true);
  assert.match(manifest.default_base_context_index, /docs\/base-context\/index\.md$/);
  assert.match(manifest.default_topic_root, /\.ax\/topics$/);
  assert.match(
    adapter.renderBootstrapInstructions('/repo'),
    /hook|SessionStart|context injection|worktree-create/i,
  );
});

test('platform adapters produce shift-ax command routes for core flows', () => {
  const codex = getPlatformAdapter('codex');
  const claude = getPlatformAdapter('claude-code');

  assert.deepEqual(codex.commandFor('bootstrap-topic'), ['shift-ax', 'bootstrap-topic']);
  assert.deepEqual(codex.commandFor('resolve-context'), ['shift-ax', 'resolve-context']);
  assert.deepEqual(codex.commandFor('review'), ['shift-ax', 'review']);
  assert.deepEqual(codex.commandFor('worktree-plan'), ['shift-ax', 'worktree-plan']);
  assert.deepEqual(codex.commandFor('worktree-create'), ['shift-ax', 'worktree-create']);
  assert.deepEqual(codex.commandFor('worktree-remove'), ['shift-ax', 'worktree-remove']);
  assert.deepEqual(codex.commandFor('onboard-context'), ['shift-ax', 'onboard-context']);
  assert.deepEqual(codex.commandFor('run-request'), ['shift-ax', 'run-request']);
  assert.deepEqual(codex.commandFor('approve-plan'), ['shift-ax', 'approve-plan']);
  assert.deepEqual(codex.commandFor('finalize-commit'), ['shift-ax', 'finalize-commit']);
  assert.deepEqual(codex.commandFor('launch-execution'), ['shift-ax', 'launch-execution']);

  assert.deepEqual(claude.commandFor('bootstrap-topic'), ['shift-ax', 'bootstrap-topic']);
  assert.deepEqual(claude.commandFor('resolve-context'), ['shift-ax', 'resolve-context']);
  assert.deepEqual(claude.commandFor('review'), ['shift-ax', 'review']);
  assert.deepEqual(claude.commandFor('worktree-plan'), ['shift-ax', 'worktree-plan']);
  assert.deepEqual(claude.commandFor('worktree-create'), ['shift-ax', 'worktree-create']);
  assert.deepEqual(claude.commandFor('worktree-remove'), ['shift-ax', 'worktree-remove']);
  assert.deepEqual(claude.commandFor('onboard-context'), ['shift-ax', 'onboard-context']);
  assert.deepEqual(claude.commandFor('run-request'), ['shift-ax', 'run-request']);
  assert.deepEqual(claude.commandFor('approve-plan'), ['shift-ax', 'approve-plan']);
  assert.deepEqual(claude.commandFor('finalize-commit'), ['shift-ax', 'finalize-commit']);
  assert.deepEqual(claude.commandFor('launch-execution'), ['shift-ax', 'launch-execution']);
});

test('platform adapters expose worktree capability metadata', () => {
  const codex = getPlatformAdapter('codex');
  const claude = getPlatformAdapter('claude-code');

  const codexManifest = codex.getManifest('/repo');
  const claudeManifest = claude.getManifest('/repo');

  assert.equal(codexManifest.worktree_support, 'available');
  assert.equal(claudeManifest.worktree_support, 'available');

  assert.deepEqual(codexManifest.worktree_runtime.operations.plan.command, [
    'shift-ax',
    'worktree-plan',
  ]);
  assert.deepEqual(codexManifest.worktree_runtime.operations.create.command, [
    'shift-ax',
    'worktree-create',
  ]);
  assert.deepEqual(codexManifest.worktree_runtime.operations.remove.command, [
    'shift-ax',
    'worktree-remove',
  ]);
  assert.match(
    codexManifest.worktree_runtime.upstream_boundary.provenance_doc,
    /platform\/codex\/upstream\/worktree\/provenance\.md$/,
  );
  assert.equal(codexManifest.worktree_runtime.upstream_boundary.active_imports.length, 2);
  assert.equal(
    codexManifest.worktree_runtime.upstream_boundary.active_imports[0].source_commit,
    'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee',
  );
  assert.equal(
    codexManifest.worktree_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/worktree.ts',
  );
  assert.equal(codexManifest.tmux_runtime.support, 'imported-helpers');
  assert.equal(codexManifest.tmux_runtime.workspace_mode, 'leader-attached-layout');
  assert.equal(codexManifest.execution_runtime.support, 'available');
  assert.deepEqual(codexManifest.execution_runtime.operations.launch.command, [
    'shift-ax',
    'launch-execution',
  ]);
  assert.equal(codexManifest.tmux_runtime.upstream_boundary.active_imports.length, 3);
  assert.equal(
    codexManifest.tmux_runtime.upstream_boundary.active_imports[0].source_file,
    'src/team/tmux-session.ts',
  );
  assert.equal(
    codexManifest.tmux_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/tmux-session.ts',
  );
  assert.equal(
    codexManifest.tmux_runtime.upstream_boundary.active_imports[2].source_file,
    'src/team/tmux-session.ts',
  );

  assert.deepEqual(claudeManifest.worktree_runtime.operations.plan.command, [
    'shift-ax',
    'worktree-plan',
  ]);
  assert.deepEqual(claudeManifest.worktree_runtime.operations.create.command, [
    'shift-ax',
    'worktree-create',
  ]);
  assert.deepEqual(claudeManifest.worktree_runtime.operations.remove.command, [
    'shift-ax',
    'worktree-remove',
  ]);
  assert.match(
    claudeManifest.worktree_runtime.upstream_boundary.provenance_doc,
    /platform\/claude-code\/upstream\/worktree\/provenance\.md$/,
  );
  assert.equal(claudeManifest.worktree_runtime.upstream_boundary.active_imports.length, 2);
  assert.equal(
    claudeManifest.worktree_runtime.upstream_boundary.active_imports[0].source_commit,
    '2487d3878f8d25e60802940b020d5ee8774d135e',
  );
  assert.equal(
    claudeManifest.worktree_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/git-worktree.ts',
  );
  assert.equal(claudeManifest.tmux_runtime.support, 'imported-helpers');
  assert.equal(claudeManifest.tmux_runtime.workspace_mode, 'detached-sessions');
  assert.equal(claudeManifest.execution_runtime.support, 'available');
  assert.deepEqual(claudeManifest.execution_runtime.operations.launch.command, [
    'shift-ax',
    'launch-execution',
  ]);
  assert.equal(claudeManifest.tmux_runtime.upstream_boundary.active_imports.length, 2);
  assert.equal(
    claudeManifest.tmux_runtime.upstream_boundary.active_imports[0].source_file,
    'src/team/tmux-session.ts',
  );
  assert.equal(
    claudeManifest.tmux_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/tmux-session.ts',
  );
});

test('platform adapters canonicalize nested repo paths for manifests', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'shift-ax-adapter-root-'));

  try {
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoRoot, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: repoRoot, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: repoRoot, stdio: 'pipe' });
    await mkdir(join(repoRoot, 'packages', 'app'), { recursive: true });
    await writeFile(join(repoRoot, 'README.md'), '# repo\n', 'utf8');
    execFileSync('git', ['add', 'README.md'], { cwd: repoRoot, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repoRoot, stdio: 'pipe' });

    const nestedCwd = join(repoRoot, 'packages', 'app');
    const canonicalRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: nestedCwd,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    const codex = getPlatformAdapter('codex');
    const claude = getPlatformAdapter('claude-code');

    assert.equal(
      codex.getManifest(nestedCwd).default_base_context_index,
      join(canonicalRoot, 'docs', 'base-context', 'index.md'),
    );
    assert.equal(
      claude.getManifest(nestedCwd).default_base_context_index,
      join(canonicalRoot, 'docs', 'base-context', 'index.md'),
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
