#!/usr/bin/env node

import { join } from 'node:path';

import { resolveContextFromIndex } from '../core/context/index-resolver.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-resolve-context [--index PATH] --query "<text>" [--root DIR] [--max N]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const indexPath = readArg('--index') || join(rootDir, 'docs', 'base-context', 'index.md');
const query = readArg('--query');
const maxMatches = Number.parseInt(readArg('--max') || '5', 10);

if (!query) {
  usage();
  process.exit(1);
}

const result = await resolveContextFromIndex({
  rootDir,
  indexPath,
  query,
  maxMatches: Number.isFinite(maxMatches) && maxMatches > 0 ? maxMatches : 5,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
