#!/usr/bin/env node

import { scaffoldPlatformBuild } from '../platform/scaffold.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-scaffold-build --platform <codex|claude-code> [--root DIR]\n',
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

const result = await scaffoldPlatformBuild({ platform, rootDir });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
