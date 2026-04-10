import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { ShiftAxBootstrapAsset } from '../index.js';
import { buildProductShellAssets, SHIFT_AX_PRODUCT_SHELL_COMMANDS } from '../product-shell-commands.js';
import { getGlobalContextHome } from '../../core/settings/global-context-home.js';
import type { ShiftAxLocale } from '../../core/settings/project-settings.js';

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

function localePrelude(locale: ShiftAxLocale): string {
  return locale === 'ko'
    ? '선호 사용자 언어: 한국어. 사용자가 명시적으로 바꾸라고 하지 않으면 한국어로 응답하세요.'
    : 'Preferred user language: English. Respond in English unless the user explicitly asks to switch.';
}

function injectLocalePrelude(raw: string, locale: ShiftAxLocale): string {
  const prelude = localePrelude(locale);
  if (raw.startsWith('---\n')) {
    const closing = raw.indexOf('\n---\n', 4);
    if (closing !== -1) {
      const frontmatter = raw.slice(0, closing + 5);
      const rest = raw.slice(closing + 5);
      return `${frontmatter}\n${prelude}\n\n${rest}`;
    }
  }
  return `${prelude}\n\n${raw}`;
}

function renderTemplate(relativePath: (typeof TEMPLATE_FILES)[number], rootDir: string, locale: ShiftAxLocale): string {
  const raw = readFileSync(templatePath(relativePath), 'utf8');
  return injectLocalePrelude(
    raw
    .replaceAll('{{BASE_CONTEXT_INDEX}}', `${rootDir}/docs/base-context/index.md`)
    .replaceAll('{{GLOBAL_CONTEXT_INDEX}}', getGlobalContextHome().indexPath),
    locale,
  );
}

export function codexScaffoldTemplateFiles(): string[] {
  return [...TEMPLATE_FILES];
}

export function renderCodexAgentsBootstrap(rootDir: string, locale: ShiftAxLocale = 'en'): string {
  return renderTemplate('platform/codex/scaffold/AGENTS.template.md', rootDir, locale);
}

export function renderCodexPromptBootstrap(rootDir: string, locale: ShiftAxLocale = 'en'): string {
  return renderTemplate('platform/codex/scaffold/prompts/shift-ax-bootstrap.template.md', rootDir, locale);
}

export function getCodexBootstrapAssets(rootDir: string, locale: ShiftAxLocale = 'en'): ShiftAxBootstrapAsset[] {
  const commandAssets = buildProductShellAssets({
    platform: 'codex',
    commandBasePath: '.codex/prompts',
    renderTemplate: (name) =>
      renderTemplate(
        `platform/codex/scaffold/prompts/${name}.template.md` as (typeof TEMPLATE_FILES)[number],
        rootDir,
        locale,
      ),
  });

  return [
    {
      path: 'AGENTS.md',
      description: 'Top-level AGENTS bootstrap for Codex builds.',
      content: renderCodexAgentsBootstrap(rootDir, locale),
    },
    {
      path: '.codex/prompts/shift-ax-bootstrap.md',
      description: 'Codex bootstrap prompt fragment.',
      content: renderCodexPromptBootstrap(rootDir, locale),
    },
    ...commandAssets,
  ];
}
