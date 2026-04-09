#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { readTeamPreferences, writeTeamPreferences } from '../core/policies/team-preferences.js';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const inputPath = readArg('--input');

if (inputPath) {
  const raw = await readFile(inputPath, 'utf8');
  await writeTeamPreferences({
    rootDir,
    preferences: JSON.parse(raw),
  });
}

const result = await readTeamPreferences(rootDir);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
