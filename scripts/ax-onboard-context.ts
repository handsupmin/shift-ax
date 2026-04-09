#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';

import {
  onboardProjectContext,
  onboardProjectContextFromDiscovery,
} from '../core/context/onboarding.js';
import { runGuidedOnboarding } from '../core/context/guided-onboarding.js';
import type { ShiftAxLocale } from '../core/settings/project-settings.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-onboard-context [--input FILE] [--discover] [--no-glossary] [--lang en|ko] [--root DIR]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
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
          output: stderr,
        })
      : null;

  return {
    ask: async (question: string) => {
      if (rl) {
        return rl.question(question);
      }

      stderr.write(question);
      const answer = fallbackAnswers?.[fallbackIndex] ?? '';
      fallbackIndex += 1;
      return answer;
    },
    close: () => rl?.close(),
  };
}

async function promptLocaleSelection(ask: (question: string) => Promise<string>): Promise<ShiftAxLocale> {
  const answer = (await ask(
    'Choose language / 언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
  ))
    .trim()
    .toLowerCase();
  return answer === '2' ? 'ko' : 'en';
}

async function main(): Promise<void> {
  const inputPath = readArg('--input');
  const rootDir = readArg('--root') || process.cwd();
  const discover = process.argv.includes('--discover');
  const includeGlossary = !process.argv.includes('--no-glossary');
  const localeArg = readArg('--lang');
  const prompts =
    inputPath || discover || localeArg
      ? null
      : await createPromptSession();

  const locale =
    localeArg === 'ko' || localeArg === 'en'
      ? localeArg
      : inputPath || discover
        ? 'en'
        : await promptLocaleSelection(prompts!.ask);

  try {
    const result = inputPath
      ? await onboardProjectContext({
          ...(JSON.parse(await readFile(inputPath, 'utf8')) as Parameters<
            typeof onboardProjectContext
          >[0]),
          rootDir,
        })
      : discover
        ? await onboardProjectContextFromDiscovery({ rootDir, includeGlossary })
        : await runGuidedOnboarding({
            rootDir,
            locale,
            ask: prompts!.ask,
          });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    prompts?.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
