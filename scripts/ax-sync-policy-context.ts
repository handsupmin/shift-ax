#!/usr/bin/env node

import { completePolicyContextSync, type ShiftAxPolicyContextSyncEntry } from '../core/planning/policy-context-sync.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-sync-policy-context --topic DIR --summary "<text>" [--path REL_PATH]... [--entry "Label -> path"]...\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readArgs(flag: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, index) => {
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  });
  return values;
}

function parseEntry(value: string): ShiftAxPolicyContextSyncEntry {
  const [label, path] = value.split('->').map((part) => part.trim());
  if (!label || !path) {
    throw new Error(`invalid --entry value: ${value}`);
  }
  return { label, path };
}

const topicDir = readArg('--topic');
const summary = readArg('--summary');

if (!topicDir || !summary) {
  usage();
  process.exit(1);
}

const result = await completePolicyContextSync({
  topicDir,
  summary,
  syncedPaths: readArgs('--path'),
  syncedEntries: readArgs('--entry').map(parseEntry),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
