#!/usr/bin/env node

import { listVerificationDebt } from '../core/observability/verification-debt.js';

function usage(): void {
  process.stderr.write('Usage: ax-verification-debt [--root DIR] [--topic DIR]\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root');
const topicDir = readArg('--topic');

if (!rootDir && !topicDir) {
  usage();
  process.exit(1);
}

const result = await listVerificationDebt({
  ...(rootDir ? { rootDir } : {}),
  ...(topicDir ? { topicDir } : {}),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
