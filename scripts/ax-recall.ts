#!/usr/bin/env node

import { searchDecisionMemory } from '../core/memory/decision-register.js';
import { searchPastTopics } from '../core/memory/topic-recall.js';
import { buildContextBundle } from '../core/context/context-bundle.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-recall --root DIR --scope <topic|decision|repo> --query "<text>" [--limit N]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const scope = readArg('--scope');
const query = readArg('--query');
const limit = Number(readArg('--limit') || '5');

if (!scope || !query || !['topic', 'decision', 'repo'].includes(scope)) {
  usage();
  process.exit(1);
}

const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;

let result: unknown;
if (scope === 'topic') {
  result = await searchPastTopics({
    rootDir,
    query,
    limit: normalizedLimit,
  });
} else if (scope === 'decision') {
  result = await searchDecisionMemory({
    rootDir,
    query,
    limit: normalizedLimit,
  });
} else {
  const bundle = await buildContextBundle({
    rootDir,
    query,
    maxChars: 3000,
  });
  result = {
    base_context: bundle.sections.find((section) => section.kind === 'base_context')?.items ?? [],
    topics: await searchPastTopics({
      rootDir,
      query,
      limit: normalizedLimit,
    }),
    decisions: await searchDecisionMemory({
      rootDir,
      query,
      limit: normalizedLimit,
    }),
  };
  }

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
