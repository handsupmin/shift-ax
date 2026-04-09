#!/usr/bin/env node

import { buildEntityMemoryView } from '../core/memory/entity-memory.js';

function usage(): void {
  process.stderr.write('Usage: ax-entity-memory --root DIR --entity NAME\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const entity = readArg('--entity');

if (!entity) {
  usage();
  process.exit(1);
}

const result = await buildEntityMemoryView({ rootDir, entity });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
