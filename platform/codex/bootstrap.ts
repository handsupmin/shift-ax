import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { ShiftAxBootstrapAsset } from '../index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILES = [
  'platform/codex/scaffold/AGENTS.template.md',
  'platform/codex/scaffold/prompts/shift-ax-bootstrap.template.md',
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
  ];
}
