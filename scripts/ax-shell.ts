#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  isProjectOnboarded,
  launchPlatformShell,
  resolveShellLocale,
  persistShellSettings,
} from '../core/shell/platform-shell.js';
import type { ShiftAxPlatform } from '../adapters/contracts.js';
import { onboardProjectContext, onboardProjectContextFromDiscovery } from '../core/context/onboarding.js';
import { readProjectSettings, type ShiftAxLocale } from '../core/settings/project-settings.js';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function usage(): void {
  process.stderr.write(
    [
      'Usage:',
      '  ax --codex [--root DIR] [--lang en|ko] [--discover] [--overwrite] [--onboarding-input FILE] [initial prompt]',
      '  ax --claude-code [--root DIR] [--lang en|ko] [--discover] [--overwrite] [--onboarding-input FILE] [initial prompt]',
      '  ax  # default product shell launcher (Codex unless global settings say otherwise)',
      '',
    ].join('\n'),
  );
}

function parsePlatform(): ShiftAxPlatform | undefined {
  if (process.argv.includes('--codex')) return 'codex';
  if (process.argv.includes('--claude-code')) return 'claude-code';
  return undefined;
}

function parseLocale(): ShiftAxLocale | undefined {
  const locale = readArg('--lang');
  return locale === 'en' || locale === 'ko' ? locale : undefined;
}

function collectPromptArgs(): string {
  const ignored = new Set([
    '--codex',
    '--claude-code',
    '--discover',
    '--overwrite',
    '--lang',
    '--root',
    '--onboarding-input',
  ]);

  const values = process.argv.slice(2);
  const result: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const token = values[index]!;
    if (ignored.has(token)) {
      if (token === '--lang' || token === '--root' || token === '--onboarding-input') {
        index += 1;
      }
      continue;
    }
    result.push(token);
  }

  return result.join(' ').trim();
}
const rootDir = readArg('--root') || process.cwd();
const requestedPlatform = parsePlatform();
const requestedLocale = parseLocale();
const onboardingInput = readArg('--onboarding-input');
const discover = process.argv.includes('--discover');
const overwrite = process.argv.includes('--overwrite');
const prompt = collectPromptArgs();
const existingSettings = await readProjectSettings(rootDir);
const onboarded = await isProjectOnboarded(rootDir);

if ((requestedLocale === undefined && process.argv.includes('--lang')) || process.argv.includes('--help')) {
  usage();
  process.exit(process.argv.includes('--help') ? 0 : 1);
}

const locale = await resolveShellLocale({
  rootDir,
  requestedLocale,
});

const platform =
  requestedPlatform ??
  existingSettings?.preferred_platform ??
  'codex';

if (!onboarded) {
  if (onboardingInput) {
    await onboardProjectContext({
      ...(JSON.parse(await readFile(onboardingInput, 'utf8')) as Parameters<typeof onboardProjectContext>[0]),
      rootDir,
      overwrite,
    });
    await persistShellSettings({
      rootDir,
      locale,
      platform,
    });
  } else if (discover) {
    await onboardProjectContextFromDiscovery({
      rootDir,
      includeGlossary: true,
      overwrite,
    });
    await persistShellSettings({
      rootDir,
      locale,
      platform,
    });
  }
}

await persistShellSettings({
  rootDir,
  locale,
  platform,
});

const exitCode = await launchPlatformShell({
  rootDir,
  platform,
  ...(prompt ? { initialPrompt: prompt } : {}),
});
process.exit(exitCode);
