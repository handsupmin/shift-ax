#!/usr/bin/env node

import { summarizeTopicStatus } from '../core/observability/topic-status.js';

function usage(): void {
  process.stderr.write('Usage: ax-topic-status --topic DIR\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');

if (!topicDir) {
  usage();
  process.exit(1);
}

const summary = await summarizeTopicStatus(topicDir);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
