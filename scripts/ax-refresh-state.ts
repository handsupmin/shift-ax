#!/usr/bin/env node

import { writeRootStateSummary } from '../core/observability/state-handoff.js';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const limit = Number(readArg('--limit') || '10');

const result = await writeRootStateSummary({
  rootDir,
  limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
