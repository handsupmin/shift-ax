#!/usr/bin/env node

import { listThreads } from '../core/memory/threads.js';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const result = await listThreads({ rootDir });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
