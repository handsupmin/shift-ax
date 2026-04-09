#!/usr/bin/env node

import { writeContextBundle } from '../core/context/context-bundle.js';

function usage(): void {
  process.stderr.write(
    'Usage: ax-init-context [--root DIR] [--topic DIR] --query "<text>" [--max-chars N] [--output PATH]\n',
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
const workflowStep = readArg('--workflow-step') || 'general';
const maxChars = Number(readArg('--max-chars') || '6000');

if (!query || (!rootDir && !topicDir)) {
  usage();
  process.exit(1);
}

const result = await writeContextBundle({
  ...(rootDir ? { rootDir } : {}),
  ...(topicDir ? { topicDir } : {}),
  query,
  ...(outputPath ? { outputPath } : {}),
  workflowStep,
  maxChars: Number.isFinite(maxChars) && maxChars > 0 ? maxChars : 6000,
});

process.stdout.write(
  `${JSON.stringify(
    {
      query: result.bundle.query,
      workflow_step: workflowStep,
      status: result.status,
      issues_count: result.bundle.issues.length,
      max_chars: result.bundle.max_chars,
      sections: result.bundle.sections.map((section) => ({
        kind: section.kind,
        item_count: section.items.length,
      })),
      output_path: result.output_path,
    },
    null,
    2,
  )}\n`,
);
