#!/usr/bin/env node

import { writeTopicSummaryCheckpoint } from '../core/memory/summary-checkpoints.js';

function usage(): void {
  process.stderr.write('Usage: ax-checkpoint-context --topic DIR --summary "<text>"\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const summary = readArg('--summary');

if (!topicDir || !summary) {
  usage();
  process.exit(1);
}

const result = await writeTopicSummaryCheckpoint({
  topicDir,
  summary,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
