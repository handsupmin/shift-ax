#!/usr/bin/env node

import { promoteThreadToTopic } from '../core/memory/thread-promotion.js';

function usage(): void {
  process.stderr.write('Usage: ax-promote-thread --root DIR --name NAME --request "<text>"\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const name = readArg('--name');
const request = readArg('--request');

if (!name || !request) {
  usage();
  process.exit(1);
}

const result = await promoteThreadToTopic({ rootDir, name, request });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
