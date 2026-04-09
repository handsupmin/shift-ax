#!/usr/bin/env node

import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const assets = [
  ['platform/codex/scaffold', 'dist/platform/codex/scaffold'],
  ['platform/claude-code/scaffold', 'dist/platform/claude-code/scaffold'],
];

for (const [source, target] of assets) {
  const absoluteSource = resolve(root, source);
  const absoluteTarget = resolve(root, target);
  await mkdir(dirname(absoluteTarget), { recursive: true });
  await cp(absoluteSource, absoluteTarget, {
    recursive: true,
    force: true,
  });
}
