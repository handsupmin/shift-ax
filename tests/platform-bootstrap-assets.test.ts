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
  assert.match(content, /\/onboard/);
  assert.match(content, /product-shell commands/);
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
  assert.match(content, /\/onboard/);
  assert.match(content, /product-shell commands/);
});

test('getPlatformBootstrapAssets returns expected assets for codex', () => {
  const assets = getPlatformBootstrapAssets('codex', '/repo');

  const paths = assets.map((asset) => asset.path).sort();
  assert.deepEqual(paths, [
    '.codex/prompts/doctor.md',
    '.codex/prompts/onboard.md',
    '.codex/prompts/request.md',
    '.codex/prompts/resume.md',
    '.codex/prompts/review.md',
    '.codex/prompts/shift-ax-bootstrap.md',
    '.codex/prompts/status.md',
    '.codex/prompts/topics.md',
    'AGENTS.md',
  ]);
});

test('getPlatformBootstrapAssets returns expected assets for claude-code', () => {
  const assets = getPlatformBootstrapAssets('claude-code', '/repo');

  const paths = assets.map((asset) => asset.path).sort();
  assert.deepEqual(paths, [
    '.claude/commands/doctor.md',
    '.claude/commands/onboard.md',
    '.claude/commands/request.md',
    '.claude/commands/resume.md',
    '.claude/commands/review.md',
    '.claude/commands/status.md',
    '.claude/commands/topics.md',
    '.claude/hooks/shift-ax-session-start.md',
    'CLAUDE.md',
  ]);
});

test('codex scaffold template files are tracked under platform/codex/scaffold', () => {
  const files = codexScaffoldTemplateFiles().sort();
  assert.ok(files.includes('platform/codex/scaffold/AGENTS.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/request.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/review.template.md'));
});

test('claude-code scaffold template files are tracked under platform/claude-code/scaffold', () => {
  const files = claudeCodeScaffoldTemplateFiles().sort();
  assert.ok(files.includes('platform/claude-code/scaffold/CLAUDE.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/request.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/review.template.md'));
});
