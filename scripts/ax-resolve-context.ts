#!/usr/bin/env node

import { existsSync } from 'node:fs';

import { resolveContextFromIndex } from '../core/context/index-resolver.js';
import { getGlobalContextHome } from '../core/settings/global-context-home.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-resolve-context [--index PATH] --query "<text>" [--root DIR] [--max N]\n',
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const rootDir = readArg('--root') || process.cwd();
const defaultIndexPath = (() => {
  const home = getGlobalContextHome();
  return readArg('--index') || home.indexPath;
})();
const localFallbackIndexPath = `${rootDir}/docs/base-context/index.md`;
const indexPath = existsSync(defaultIndexPath) ? defaultIndexPath : localFallbackIndexPath;
const query = readArg('--query');
const maxMatches = Number.parseInt(readArg('--max') || '5', 10);

if (!query) {
  usage();
  process.exit(1);
}

const result = await resolveContextFromIndex({
  rootDir,
  indexPath,
  indexRootDir: indexPath === getGlobalContextHome().indexPath ? getGlobalContextHome().root : rootDir,
  query,
  maxMatches: Number.isFinite(maxMatches) && maxMatches > 0 ? maxMatches : 5,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
