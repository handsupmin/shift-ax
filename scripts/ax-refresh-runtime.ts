#!/usr/bin/env node

import { readProjectSettings, type ShiftAxLocale } from '../core/settings/project-settings.js';
import {
  refreshPlatformRuntimeAssets,
  type ShiftAxRuntimeAssetPlatform,
} from '../core/shell/platform-shell.js';
import {
  normalizeRuntimeAssetPlatform,
  normalizeUpdateLocale,
} from '../core/update/self-update.js';

function usage(): void {
  process.stderr.write(
    'Usage: shift-ax refresh-runtime [--root DIR] [--platform <codex|claude-code|both>] [--lang en|ko]\n',
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

await refreshPlatformRuntimeAssets({
  rootDir,
  platform,
  locale,
});

process.stdout.write(
  `${JSON.stringify(
    {
      status: 'ok',
      rootDir,
      platform: platform as ShiftAxRuntimeAssetPlatform,
      locale: locale as ShiftAxLocale,
      runtime_assets_refreshed: true,
    },
    null,
    2,
  )}\n`,
);
