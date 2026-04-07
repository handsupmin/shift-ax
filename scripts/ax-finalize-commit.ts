#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { finalizeTopicCommit } from '../core/finalization/commit-workflow.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-finalize-commit --topic DIR [--message-file PATH]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const messageFile = readArg('--message-file');

if (!topicDir) {
  usage();
  process.exit(1);
}

const result = await finalizeTopicCommit({
  topicDir,
  message: messageFile ? await readFile(messageFile, 'utf8') : undefined,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
