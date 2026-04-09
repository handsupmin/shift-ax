#!/usr/bin/env node

import { buildContextBundle } from '../core/context/context-bundle.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-build-context-bundle [--root DIR] [--topic DIR] --query "<text>" [--max-chars N] [--output PATH]\n',
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

const result = outputPath
  ? (await import('../core/context/context-bundle.js')).writeContextBundle({
      ...(rootDir ? { rootDir } : {}),
      ...(topicDir ? { topicDir } : {}),
      query,
      outputPath,
      maxChars: Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 6000,
    }).then(({ bundle, output_path }) => ({ ...bundle, output_path }))
  : await buildContextBundle({
      ...(rootDir ? { rootDir } : {}),
      ...(topicDir ? { topicDir } : {}),
      query,
      maxChars: Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 6000,
    });

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
