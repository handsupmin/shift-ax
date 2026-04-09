#!/usr/bin/env node

import { recordLearnedDebugNote } from '../core/memory/learned-debug.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-learned-debug-save --root DIR --summary "<text>" --resolution "<text>" [--occurrences N] [--approved] [--fix-commit SHA]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const summary = readArg('--summary');
const resolution = readArg('--resolution');
const occurrences = Number(readArg('--occurrences') || '1');
const approved = process.argv.includes('--approved');
const fixCommit = readArg('--fix-commit');

if (!summary || !resolution) {
  usage();
  process.exit(1);
}

const result = await recordLearnedDebugNote({
  rootDir,
  summary,
  resolution,
  occurrences: Number.isFinite(occurrences) ? occurrences : 1,
  approved,
  ...(fixCommit ? { fixCommit } : {}),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
