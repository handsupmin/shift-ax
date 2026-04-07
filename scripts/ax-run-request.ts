#!/usr/bin/env node

import {
  resumeRequestPipeline,
  startRequestPipeline,
} from '../core/planning/request-pipeline.js';
import { parseEscalationArgument } from '../core/planning/escalation.js';

function usage(): void {
  process.stderr.write(
    [
      'Usage:',
      '  ax-run-request --request "<text>" [--summary "<text>"] [--brainstorm-file PATH] [--spec-file PATH] [--plan-file PATH] [--index PATH] [--root DIR] [--base BRANCH]',
      '  ax-run-request --topic DIR --resume [--verify-command CMD]... [--escalation KIND[:summary]]... [--clear-escalations] [--escalation-resolution "<text>"]',
      '',
    ].join('\n'),
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

async function readMaybeFile(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}

const topicDir = readArg('--topic');
const resume = process.argv.includes('--resume');

if (resume) {
  if (!topicDir) {
    usage();
    process.exit(1);
  }

  const result = await resumeRequestPipeline({
    topicDir,
    verificationCommands: readArgs('--verify-command'),
    escalationTriggers: readArgs('--escalation').map((value) =>
      parseEscalationArgument(value),
    ),
    clearEscalations: process.argv.includes('--clear-escalations'),
    escalationResolution: readArg('--escalation-resolution'),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const request = readArg('--request');
if (!request) {
  usage();
  process.exit(1);
}

const result = await startRequestPipeline({
  rootDir: readArg('--root') || process.cwd(),
  request,
  summary: readArg('--summary'),
  indexPath: readArg('--index'),
  brainstormContent: await readMaybeFile(readArg('--brainstorm-file')),
  specContent: await readMaybeFile(readArg('--spec-file')),
  implementationPlanContent: await readMaybeFile(readArg('--plan-file')),
  baseBranch: readArg('--base') || 'main',
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
