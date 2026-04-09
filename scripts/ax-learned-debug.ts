#!/usr/bin/env node

import { listLearnedDebugNotes } from '../core/memory/learned-debug.js';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const query = readArg('--query');
const result = await listLearnedDebugNotes({ rootDir, ...(query ? { query } : {}) });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
