#!/usr/bin/env node

import { getPlatformAdapter } from '../adapters/index.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-launch-execution --platform <codex|claude-code> --topic DIR [--task-id ID] [--dry-run]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const platform = readArg('--platform');
const topicDir = readArg('--topic');
const taskId = readArg('--task-id');
const dryRun = process.argv.includes('--dry-run');

if ((platform !== 'codex' && platform !== 'claude-code') || !topicDir) {
  usage();
  process.exit(1);
}

const adapter = getPlatformAdapter(platform);
const result = dryRun
  ? await adapter.planExecution({ topicDir, taskId })
  : await adapter.launchExecution({ topicDir, taskId });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
