import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPlatformBootstrapAssets,
  renderCodexAgentsBootstrap,
  renderClaudeCodeSessionStartContext,
} from '../platform/index.js';
import {
  codexScaffoldTemplateFiles,
} from '../platform/codex/bootstrap.js';
import {
  claudeCodeScaffoldTemplateFiles,
} from '../platform/claude-code/bootstrap.js';

test('renderCodexAgentsBootstrap references base-context and request-to-commit commands', () => {
  const content = renderCodexAgentsBootstrap('/repo');

  assert.match(content, /docs\/base-context\/index\.md/);
  assert.match(content, /ax resolve-context/);
  assert.match(content, /ax onboard-context/);
  assert.match(content, /ax run-request/);
  assert.match(content, /ax approve-plan/);
  assert.match(content, /ax finalize-commit/);
  assert.match(content, /ax worktree-plan/);
  assert.match(content, /ax worktree-create/);
  assert.match(content, /ax worktree-remove/);
  assert.match(content, /platform\/codex\/upstream\/worktree\/provenance\.md/);
  assert.match(content, /resolveRepoRoot/);
  assert.match(content, /ensureCodexManagedWorktree/);
  assert.match(content, /natural language/i);
});

test('renderClaudeCodeSessionStartContext references base-context and request-to-commit commands', () => {
  const content = renderClaudeCodeSessionStartContext('/repo');

  assert.match(content, /docs\/base-context\/index\.md/);
  assert.match(content, /SessionStart|hook/i);
  assert.match(content, /ax resolve-context/);
  assert.match(content, /ax onboard-context/);
  assert.match(content, /ax run-request/);
  assert.match(content, /ax approve-plan/);
  assert.match(content, /ax finalize-commit/);
  assert.match(content, /ax worktree-plan/);
  assert.match(content, /ax worktree-create/);
  assert.match(content, /ax worktree-remove/);
  assert.match(content, /platform\/claude-code\/upstream\/worktree\/provenance\.md/);
  assert.match(content, /getWorktreeRoot/);
  assert.match(content, /createClaudeManagedWorktree/);
  assert.match(content, /natural language/i);
});

test('getPlatformBootstrapAssets returns expected assets for codex', () => {
  const assets = getPlatformBootstrapAssets('codex', '/repo');

  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['AGENTS.md', '.codex/prompts/shift-ax-bootstrap.md'],
  );
});

test('getPlatformBootstrapAssets returns expected assets for claude-code', () => {
  const assets = getPlatformBootstrapAssets('claude-code', '/repo');

  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['CLAUDE.md', '.claude/hooks/shift-ax-session-start.md'],
  );
});

test('codex scaffold template files are tracked under platform/codex/scaffold', () => {
  assert.deepEqual(codexScaffoldTemplateFiles().sort(), [
    'platform/codex/scaffold/AGENTS.template.md',
    'platform/codex/scaffold/prompts/shift-ax-bootstrap.template.md',
  ]);
});

test('claude-code scaffold template files are tracked under platform/claude-code/scaffold', () => {
  assert.deepEqual(claudeCodeScaffoldTemplateFiles().sort(), [
    'platform/claude-code/scaffold/CLAUDE.template.md',
    'platform/claude-code/scaffold/hooks/shift-ax-session-start.template.md',
  ]);
});
