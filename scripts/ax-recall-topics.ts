#!/usr/bin/env node

import { searchPastTopics } from '../core/memory/topic-recall.js';

function usage(): void {
  process.stderr.write('Usage: ax-recall-topics --query "<text>" [--root DIR] [--limit N]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const query = readArg('--query');
const rootDir = readArg('--root') || process.cwd();
const limit = Number.parseInt(readArg('--limit') || '5', 10);

if (!query) {
  usage();
  process.exit(1);
}

const result = await searchPastTopics({ rootDir, query, limit });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
