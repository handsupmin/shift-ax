#!/usr/bin/env node

import { writeContextMonitorSnapshot } from '../core/observability/context-monitor.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-monitor-context [--root DIR] [--topic DIR] --query "<text>" [--max-chars N] [--output PATH]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root');
const topicDir = readArg('--topic');
const query = readArg('--query');
const outputPath = readArg('--output');
const maxChars = Number(readArg('--max-chars') || '6000');

if (!query || (!rootDir && !topicDir)) {
  usage();
  process.exit(1);
}

const result = await writeContextMonitorSnapshot({
  ...(rootDir ? { rootDir } : {}),
  ...(topicDir ? { topicDir } : {}),
  query,
  ...(outputPath ? { outputPath } : {}),
  maxChars: Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 6000,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
