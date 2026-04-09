#!/usr/bin/env node

import { pauseTopicWork } from '../core/observability/state-handoff.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-pause-work --topic DIR --summary "<text>" [--next-step "<text>"] [--command "<text>"]...\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readArgs(flag: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, index) => {
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  });
  return values;
}

const topicDir = readArg('--topic');
const summary = readArg('--summary');

if (!topicDir || !summary) {
  usage();
  process.exit(1);
}

const result = await pauseTopicWork({
  topicDir,
  summary,
  nextStep: readArg('--next-step'),
  commands: readArgs('--command'),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
