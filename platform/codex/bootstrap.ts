import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { ShiftAxBootstrapAsset } from '../index.js';
import { buildProductShellAssets, SHIFT_AX_PRODUCT_SHELL_COMMANDS } from '../product-shell-commands.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILES = [
  'platform/codex/scaffold/AGENTS.template.md',
  'platform/codex/scaffold/prompts/shift-ax-bootstrap.template.md',
  ...SHIFT_AX_PRODUCT_SHELL_COMMANDS.map(
    (name) => `platform/codex/scaffold/prompts/${name}.template.md` as const,
  ),
] as const;

function templatePath(relativePath: (typeof TEMPLATE_FILES)[number]): string {
  return join(HERE, 'scaffold', relativePath.split('/').slice(3).join('/'));
}

function renderTemplate(relativePath: (typeof TEMPLATE_FILES)[number], rootDir: string): string {
  const raw = readFileSync(templatePath(relativePath), 'utf8');
  return raw.replaceAll('{{BASE_CONTEXT_INDEX}}', `${rootDir}/docs/base-context/index.md`);
}

export function codexScaffoldTemplateFiles(): string[] {
  return [...TEMPLATE_FILES];
}

export function renderCodexAgentsBootstrap(rootDir: string): string {
  return renderTemplate('platform/codex/scaffold/AGENTS.template.md', rootDir);
}

export function renderCodexPromptBootstrap(rootDir: string): string {
  return renderTemplate('platform/codex/scaffold/prompts/shift-ax-bootstrap.template.md', rootDir);
}

export function getCodexBootstrapAssets(rootDir: string): ShiftAxBootstrapAsset[] {
  const commandAssets = buildProductShellAssets({
    platform: 'codex',
    commandBasePath: '.codex/prompts',
    renderTemplate: (name) =>
      renderTemplate(
        `platform/codex/scaffold/prompts/${name}.template.md` as (typeof TEMPLATE_FILES)[number],
        rootDir,
      ),
  });

  return [
    {
      path: 'AGENTS.md',
      description: 'Top-level AGENTS bootstrap for Codex builds.',
      content: renderCodexAgentsBootstrap(rootDir),
    },
    {
      path: '.codex/prompts/shift-ax-bootstrap.md',
      description: 'Codex bootstrap prompt fragment.',
      content: renderCodexPromptBootstrap(rootDir),
    },
    ...commandAssets,
  ];
}
