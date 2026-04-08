#!/usr/bin/env node

import {
  aggregateReviewVerdicts,
  writeAggregateReviewArtifacts,
} from '../core/review/aggregate-reviews.js';
import { runReviewLanes } from '../core/review/run-lanes.js';

function usage(): void {
  process.stderr.write('Usage: ax-review --topic DIR [--run]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const shouldRun = process.argv.includes('--run');

if (!topicDir) {
  usage();
  process.exit(1);
}

if (shouldRun) {
  await runReviewLanes({ topicDir });
}

const result = await aggregateReviewVerdicts({ topicDir });
await writeAggregateReviewArtifacts(topicDir, result);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
