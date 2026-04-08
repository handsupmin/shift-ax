#!/usr/bin/env node

import { listDecisionRecords } from '../core/memory/decision-register.js';

function usage(): void {
  process.stderr.write('Usage: ax-decisions [--root DIR] [--query "<text>"] [--active-at YYYY-MM-DD]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const query = readArg('--query');
const activeAt = readArg('--active-at');

if (process.argv.includes('--help')) {
  usage();
  process.exit(0);
}

const result = await listDecisionRecords({
  rootDir,
  query,
  activeAt,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
