#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';

import {
  onboardProjectContext,
  onboardProjectContextFromDiscovery,
} from '../core/context/onboarding.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxOnboardingContextProfile,
} from '../core/policies/project-profile.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-onboard-context [--input FILE] [--discover] [--no-glossary] [--root DIR]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function toMarkdown(label: string, content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('#')) {
    return `${trimmed}\n`;
  }
  return `# ${label.trim()}\n\n${trimmed}\n`;
}

async function promptUntilNonEmpty(
  ask: (question: string) => Promise<string>,
  question: string,
): Promise<string> {
  while (true) {
    const value = (await ask(question)).trim();
    if (value !== '') return value;
  }
}

async function promptWithDefault(
  ask: (question: string) => Promise<string>,
  question: string,
  defaultValue: string,
): Promise<string> {
  const value = (await ask(`${question} [${defaultValue}]: `)).trim();
  return value || defaultValue;
}

async function promptInteractivePayload(): Promise<
  Omit<Parameters<typeof onboardProjectContext>[0], 'rootDir'>
> {
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
  const ask = async (question: string) => {
    if (rl) {
      return rl.question(question);
    }

    stderr.write(question);
    const answer = fallbackAnswers?.[fallbackIndex] ?? '';
    fallbackIndex += 1;
    return answer;
  };
  const defaults = defaultEngineeringDefaults();

  try {
    const documents: Array<{ label: string; content: string }> = [];
    let addAnother = true;

    while (addAnother) {
      const label = await promptUntilNonEmpty(ask, 'Context document label: ');
      const content = await promptUntilNonEmpty(
        ask,
        'Document notes or markdown body: ',
      );
      documents.push({
        label,
        content: toMarkdown(label, content),
      });

      const answer = (await ask('Add another context document? [y/N]: '))
        .trim()
        .toLowerCase();
      addAnother = answer === 'y' || answer === 'yes';
    }

    const onboardingContext: ShiftAxOnboardingContextProfile = {
      business_context: await promptUntilNonEmpty(
        ask,
        'Business / product context: ',
      ),
      policy_areas: (await promptUntilNonEmpty(
        ask,
        'Policy areas to care about (comma-separated): ',
      ))
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      architecture_summary: await promptUntilNonEmpty(
        ask,
        'Architecture summary: ',
      ),
      risky_domains: (await promptUntilNonEmpty(
        ask,
        'Risky domains to escalate carefully (comma-separated): ',
      ))
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    const engineeringDefaults: ShiftAxEngineeringDefaults = {
      test_strategy: await promptWithDefault(
        ask,
        'Default test strategy',
        defaults.test_strategy,
      ),
      architecture: await promptWithDefault(
        ask,
        'Default architecture boundary',
        defaults.architecture,
      ),
      short_task_execution: await promptWithDefault(
        ask,
        'Short task execution mode',
        defaults.short_task_execution,
      ),
      long_task_execution: await promptWithDefault(
        ask,
        'Long task execution mode',
        defaults.long_task_execution,
      ),
      verification_commands: defaults.verification_commands,
    };

    return {
      documents,
      onboardingContext,
      engineeringDefaults,
    };
  } finally {
    rl?.close();
  }
}

async function main(): Promise<void> {
  const inputPath = readArg('--input');
  const rootDir = readArg('--root') || process.cwd();
  const discover = process.argv.includes('--discover');
  const includeGlossary = !process.argv.includes('--no-glossary');

  const result = inputPath
    ? await onboardProjectContext({
        ...(JSON.parse(await readFile(inputPath, 'utf8')) as Parameters<
          typeof onboardProjectContext
        >[0]),
        rootDir,
      })
    : discover
      ? await onboardProjectContextFromDiscovery({ rootDir, includeGlossary })
      : await onboardProjectContext({
          ...(await promptInteractivePayload()),
          rootDir,
        });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
