#!/usr/bin/env node

import { recordPlanReviewDecision } from '../core/planning/plan-review.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-approve-plan --topic DIR --reviewer NAME --decision <approve|reject> [--notes "<text>"]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const reviewer = readArg('--reviewer');
const decision = readArg('--decision');
const notes = readArg('--notes');

if (!topicDir || !reviewer || !decision) {
  usage();
  process.exit(1);
}

if (decision !== 'approve' && decision !== 'reject') {
  usage();
  process.exit(1);
}

const result = await recordPlanReviewDecision({
  topicDir,
  reviewer,
  status: decision === 'approve' ? 'approved' : 'changes_requested',
  notes,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
