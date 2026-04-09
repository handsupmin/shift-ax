#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import {
  isProjectOnboarded,
  launchPlatformShell,
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
      '  ax --codex [--root DIR] [--lang en|ko] [--discover] [--onboarding-input FILE] [initial prompt]',
      '  ax --claude-code [--root DIR] [--lang en|ko] [--discover] [--onboarding-input FILE] [initial prompt]',
      '  ax  # interactive platform shell launcher',
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

async function createPromptSession(): Promise<{
  ask: (question: string) => Promise<string>;
  close: () => void;
}> {
  const fallbackAnswers = !stdin.isTTY
    ? (await new Promise<string>((resolve, reject) => {
        let raw = '';
        stdin.setEncoding('utf8');
        stdin.on('data', (chunk) => {
          raw += chunk;
        });
        stdin.on('end', () => resolve(raw));
        stdin.on('error', reject);
      }))
        .split(/\r?\n/)
    : null;
  let fallbackIndex = 0;
  const rl =
    stdin.isTTY
      ? createInterface({
          input: stdin,
          output: stdout,
        })
      : null;

  return {
    ask: async (question: string) => {
      if (rl) {
        return rl.question(question);
      }
      stdout.write(question);
      const answer = fallbackAnswers?.[fallbackIndex] ?? '';
      fallbackIndex += 1;
      return answer;
    },
    close: () => rl?.close(),
  };
}

const rootDir = readArg('--root') || process.cwd();
const requestedPlatform = parsePlatform();
const requestedLocale = parseLocale();
const onboardingInput = readArg('--onboarding-input');
const discover = process.argv.includes('--discover');
const prompt = collectPromptArgs();
const existingSettings = await readProjectSettings(rootDir);
const onboarded = await isProjectOnboarded(rootDir);
const prompts =
  (!requestedPlatform && !existingSettings?.preferred_platform) ||
  (!onboarded && !onboardingInput && !discover && !requestedPlatform)
    ? await createPromptSession()
    : null;

if ((requestedLocale === undefined && process.argv.includes('--lang')) || process.argv.includes('--help')) {
  usage();
  process.exit(process.argv.includes('--help') ? 0 : 1);
}

const locale = requestedLocale ?? existingSettings?.locale;

const platform =
  requestedPlatform ??
  existingSettings?.preferred_platform ??
  (prompts
    ? await (async () => {
        const answer = (await prompts.ask(
          locale === 'ko'
            ? '플랫폼을 선택하세요:\n1. Codex (default)\n2. Claude Code\n> '
            : 'Choose platform:\n1. Codex (default)\n2. Claude Code\n> ',
        ))
          .trim()
          .toLowerCase();
        return (answer === '2' ? 'claude-code' : 'codex') as ShiftAxPlatform;
      })()
    : 'codex');

if (!onboarded) {
  if (onboardingInput) {
    await onboardProjectContext({
      ...(JSON.parse(await readFile(onboardingInput, 'utf8')) as Parameters<typeof onboardProjectContext>[0]),
      rootDir,
    });
    await persistShellSettings({
      rootDir,
      locale: locale ?? 'en',
      platform,
    });
  } else if (discover) {
    await onboardProjectContextFromDiscovery({
      rootDir,
      includeGlossary: true,
    });
    await persistShellSettings({
      rootDir,
      locale: locale ?? 'en',
      platform,
    });
  }
}

if (onboarded) {
  const ensuredLocale =
    locale ??
    (prompts
      ? ((await (async () => {
          const answer = (await prompts.ask(
            'Choose language / 언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
          ))
            .trim()
            .toLowerCase();
          return answer === '2' ? 'ko' : 'en';
        })()) as ShiftAxLocale)
      : 'en');

  await persistShellSettings({
    rootDir,
    locale: ensuredLocale,
    platform,
  });
}

const exitCode = await launchPlatformShell({
  rootDir,
  platform,
  ...(locale ? { locale } : {}),
  onboardingRequired: !onboarded && !onboardingInput && !discover,
  ...(prompt ? { initialPrompt: prompt } : {}),
});

prompts?.close();
process.exit(exitCode);
