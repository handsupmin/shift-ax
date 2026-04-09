import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { ShiftAxBootstrapAsset } from '../index.js';
import { buildProductShellAssets, SHIFT_AX_PRODUCT_SHELL_COMMANDS } from '../product-shell-commands.js';
import { getGlobalContextHome } from '../../core/settings/global-context-home.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILES = [
  'platform/claude-code/scaffold/CLAUDE.template.md',
  'platform/claude-code/scaffold/hooks/shift-ax-session-start.template.md',
  ...SHIFT_AX_PRODUCT_SHELL_COMMANDS.map(
    (name) => `platform/claude-code/scaffold/commands/${name}.template.md` as const,
  ),
] as const;

function templatePath(relativePath: (typeof TEMPLATE_FILES)[number]): string {
  return join(HERE, 'scaffold', relativePath.split('/').slice(3).join('/'));
}

function renderTemplate(relativePath: (typeof TEMPLATE_FILES)[number], rootDir: string): string {
  const raw = readFileSync(templatePath(relativePath), 'utf8');
  return raw
    .replaceAll('{{BASE_CONTEXT_INDEX}}', `${rootDir}/docs/base-context/index.md`)
    .replaceAll('{{GLOBAL_CONTEXT_INDEX}}', getGlobalContextHome().indexPath);
}

export function claudeCodeScaffoldTemplateFiles(): string[] {
  return [...TEMPLATE_FILES];
}

export function renderClaudeCodeSessionStartContext(rootDir: string): string {
  return renderTemplate(
    'platform/claude-code/scaffold/hooks/shift-ax-session-start.template.md',
    rootDir,
  );
}

export function renderClaudeCodeBootstrap(rootDir: string): string {
  return renderTemplate('platform/claude-code/scaffold/CLAUDE.template.md', rootDir);
}

export function getClaudeCodeBootstrapAssets(rootDir: string): ShiftAxBootstrapAsset[] {
  const commandAssets = buildProductShellAssets({
    platform: 'claude-code',
    commandBasePath: '.claude/commands',
    renderTemplate: (name) =>
      renderTemplate(
        `platform/claude-code/scaffold/commands/${name}.template.md` as (typeof TEMPLATE_FILES)[number],
        rootDir,
      ),
  });

  return [
    {
      path: 'CLAUDE.md',
      description: 'Top-level CLAUDE bootstrap for Claude Code builds.',
      content: renderClaudeCodeBootstrap(rootDir),
    },
    {
      path: '.claude/hooks/shift-ax-session-start.md',
      description: 'SessionStart hook payload guidance for Claude Code builds.',
      content: renderClaudeCodeSessionStartContext(rootDir),
    },
    ...commandAssets,
  ];
}
