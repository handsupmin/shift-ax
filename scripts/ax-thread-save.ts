#!/usr/bin/env node

import { saveThreadNote } from '../core/memory/threads.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-thread-save --root DIR --name NAME [--summary "<text>"] --note "<text>"\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const name = readArg('--name');
const summary = readArg('--summary');
const note = readArg('--note');

if (!name || !note) {
  usage();
  process.exit(1);
}

const result = await saveThreadNote({
  rootDir,
  name,
  ...(summary ? { summary } : {}),
  note,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
