#!/usr/bin/env node

import { listTopicsStatus } from '../core/observability/topics-status.js';

function usage(): void {
  process.stderr.write('Usage: ax-topics-status [--root DIR] [--limit N]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const limit = Number(readArg('--limit') || '10');

if (process.argv.includes('--help')) {
  usage();
  process.exit(0);
}

const result = await listTopicsStatus({
  rootDir,
  limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
