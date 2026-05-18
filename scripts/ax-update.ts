#!/usr/bin/env node

import { readProjectSettings } from '../core/settings/project-settings.js';
import {
  normalizeRuntimeAssetPlatform,
  normalizeUpdateLocale,
  runShiftAxUpdate,
} from '../core/update/self-update.js';

function usage(): void {
  process.stderr.write(
    'Usage: shift-ax update [--root DIR] [--platform <codex|claude-code|both>] [--lang en|ko]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

if (process.argv.includes('--help')) {
  usage();
  process.exit(0);
}

const rootDir = readArg('--root') || process.cwd();
const platform = normalizeRuntimeAssetPlatform(readArg('--platform'), 'both');
if (!platform) {
  usage();
  process.exit(1);
}

const savedLocale = (await readProjectSettings(rootDir))?.locale;
const locale = normalizeUpdateLocale(readArg('--lang'), savedLocale ?? 'en');
if (!locale) {
  usage();
  process.exit(1);
}

const result = await runShiftAxUpdate({
  rootDir,
  platform,
  locale,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
