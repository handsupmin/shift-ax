#!/usr/bin/env node

import { applyFeedbackReaction } from '../core/planning/feedback-reactions.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-react-feedback --topic DIR --kind <review-changes-requested|ci-failed> --summary "<text>"\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const kind = readArg('--kind');
const summary = readArg('--summary');

if (!topicDir || !kind || !summary) {
  usage();
  process.exit(1);
}

if (kind !== 'review-changes-requested' && kind !== 'ci-failed') {
  usage();
  process.exit(1);
}

const result = await applyFeedbackReaction({
  topicDir,
  kind,
  summary,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
