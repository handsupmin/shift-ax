#!/usr/bin/env node

import { bootstrapTopic } from '../core/topics/bootstrap.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-bootstrap-topic --request "<text>" [--summary "<text>"] [--root DIR]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const request = readArg('--request');
const summary = readArg('--summary');
const rootDir = readArg('--root') || process.cwd();

if (!request) {
  usage();
  process.exit(1);
}

const result = await bootstrapTopic({
  rootDir,
  request,
  summary,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
