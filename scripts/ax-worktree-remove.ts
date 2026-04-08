#!/usr/bin/env node

import { removeTopicWorktree } from '../core/topics/worktree-runtime.js';

function usage(): void {
  process.stderr.write('Usage: ax-worktree-remove --topic DIR\n');
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

const result = await removeTopicWorktree({ topicDir });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
