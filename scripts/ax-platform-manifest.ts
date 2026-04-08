#!/usr/bin/env node

import { getPlatformAdapter } from '../adapters/index.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-platform-manifest --platform <codex|claude-code> [--root DIR]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const platform = readArg('--platform');
const rootDir = readArg('--root') || process.cwd();

if (platform !== 'codex' && platform !== 'claude-code') {
  usage();
  process.exit(1);
}

const adapter = getPlatformAdapter(platform);
process.stdout.write(`${JSON.stringify(adapter.getManifest(rootDir), null, 2)}\n`);
