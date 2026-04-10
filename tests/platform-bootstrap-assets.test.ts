import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPlatformBootstrapAssets,
  renderCodexAgentsBootstrap,
  renderClaudeCodeSessionStartContext,
} from '../platform/index.js';
import { SHIFT_AX_PRODUCT_SHELL_COMMANDS } from '../platform/product-shell-commands.js';
import {
  codexScaffoldTemplateFiles,
} from '../platform/codex/bootstrap.js';
import {
  claudeCodeScaffoldTemplateFiles,
} from '../platform/claude-code/bootstrap.js';

test('renderCodexAgentsBootstrap references global index and request-to-commit commands', () => {
  const content = renderCodexAgentsBootstrap('/repo');

  assert.match(content, /\.shift-ax\/index\.md/);
  assert.match(content, /shift-ax resolve-context/);
  assert.match(content, /\$onboard/);
  assert.match(content, /shift-ax run-request/);
  assert.match(content, /shift-ax approve-plan/);
  assert.match(content, /shift-ax finalize-commit/);
  assert.match(content, /shift-ax worktree-plan/);
  assert.match(content, /shift-ax worktree-create/);
  assert.match(content, /shift-ax worktree-remove/);
  assert.match(content, /platform\/codex\/upstream\/worktree\/provenance\.md/);
  assert.match(content, /resolveRepoRoot/);
  assert.match(content, /ensureCodexManagedWorktree/);
  assert.match(content, /natural language/i);
  assert.match(content, /\$onboard/);
  assert.match(content, /visible product-shell commands/);
  assert.match(content, /\$request <text>/);
});

test('renderCodexAgentsBootstrap localizes the preferred user language note', () => {
  const content = renderCodexAgentsBootstrap('/repo', 'ko');
  assert.match(content, /한국어로 응답하세요/);
});

test('renderClaudeCodeSessionStartContext references global index and request-to-commit commands', () => {
  const content = renderClaudeCodeSessionStartContext('/repo');

  assert.match(content, /\.shift-ax\/index\.md/);
  assert.match(content, /SessionStart|hook/i);
  assert.match(content, /shift-ax resolve-context/);
  assert.match(content, /\/onboard/);
  assert.match(content, /shift-ax run-request/);
  assert.match(content, /shift-ax approve-plan/);
  assert.match(content, /shift-ax finalize-commit/);
  assert.match(content, /shift-ax worktree-plan/);
  assert.match(content, /shift-ax worktree-create/);
  assert.match(content, /shift-ax worktree-remove/);
  assert.match(content, /platform\/claude-code\/upstream\/worktree\/provenance\.md/);
  assert.match(content, /getWorktreeRoot/);
  assert.match(content, /createClaudeManagedWorktree/);
  assert.match(content, /natural language/i);
  assert.match(content, /\/onboard/);
  assert.match(content, /primary visible commands/);
  assert.match(content, /\$request <text>/);
});

test('renderClaudeCodeSessionStartContext localizes the preferred user language note', () => {
  const content = renderClaudeCodeSessionStartContext('/repo', 'ko');
  assert.match(content, /한국어로 응답하세요/);
});

test('getPlatformBootstrapAssets returns expected assets for codex', () => {
  const assets = getPlatformBootstrapAssets('codex', '/repo');

  const paths = assets.map((asset) => asset.path).sort();
  assert.deepEqual(
    paths,
    ['AGENTS.md', '.codex/prompts/shift-ax-bootstrap.md', ...SHIFT_AX_PRODUCT_SHELL_COMMANDS.map((name) => `.codex/prompts/${name}.md`)].sort(),
  );
});

test('getPlatformBootstrapAssets returns expected assets for claude-code', () => {
  const assets = getPlatformBootstrapAssets('claude-code', '/repo');

  const paths = assets.map((asset) => asset.path).sort();
  assert.deepEqual(
    paths,
    ['CLAUDE.md', '.claude/hooks/shift-ax-session-start.md', ...SHIFT_AX_PRODUCT_SHELL_COMMANDS.map((name) => `.claude/commands/${name}.md`)].sort(),
  );
});

test('codex scaffold template files are tracked under platform/codex/scaffold', () => {
  const files = codexScaffoldTemplateFiles().sort();
  assert.ok(files.includes('platform/codex/scaffold/AGENTS.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/request.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/onboard.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/export-context.template.md'));
  assert.ok(files.includes('platform/codex/scaffold/prompts/review.template.md'));
});

test('claude-code scaffold template files are tracked under platform/claude-code/scaffold', () => {
  const files = claudeCodeScaffoldTemplateFiles().sort();
  assert.ok(files.includes('platform/claude-code/scaffold/CLAUDE.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/request.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/onboard.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/export-context.template.md'));
  assert.ok(files.includes('platform/claude-code/scaffold/commands/review.template.md'));
});
