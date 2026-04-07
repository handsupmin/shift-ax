#!/usr/bin/env node

import { createTopicWorktree } from '../core/topics/worktree-runtime.js';

function usage(): void {
  process.stderr.write('Usage: ax-worktree-create --topic DIR [--base BRANCH]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const topicDir = readArg('--topic');
const baseBranch = readArg('--base') || 'main';

if (!topicDir) {
  usage();
  process.exit(1);
}

const result = await createTopicWorktree({
  topicDir,
  baseBranch,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
