#!/usr/bin/env node

import { runDoctor } from '../core/diagnostics/doctor.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-doctor [--root DIR] [--topic DIR] [--platform <codex|claude-code>]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const topicDir = readArg('--topic');
const platformArg = readArg('--platform');

if (platformArg && platformArg !== 'codex' && platformArg !== 'claude-code') {
  usage();
  process.exit(1);
}

const platform = platformArg as 'codex' | 'claude-code' | undefined;

const report = await runDoctor({
  rootDir,
  ...(topicDir ? { topicDir } : {}),
  ...(platform ? { platform } : {}),
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
