#!/usr/bin/env node

import { resolve } from 'node:path';

import {
  renderObjectiveEvalMarkdown,
  runObjectiveEvalSuite,
  writeObjectiveEvalReport,
} from '../core/evaluation/objective-eval.js';

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

if (hasFlag('--help')) {
  process.stdout.write(
    [
      'Usage:',
      '  shift-ax eval [--output DIR] [--token-budget-chars N] [--json]',
      '',
      'Runs the objective Shift AX eval suite:',
      '- context retrieval recall/MRR/false positives',
      '- planning ambiguity readiness',
      '- token budget compliance and reduction',
      '- deterministic harness FSM/DAG/retry/idempotency',
      '- review gate allow/block accuracy',
      '- request-to-plan artifact completeness',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

const outputArg = readArg('--output');
const tokenBudgetRaw = readArg('--token-budget-chars');
const tokenBudgetChars = tokenBudgetRaw ? Number(tokenBudgetRaw) : undefined;
if (tokenBudgetRaw && (!Number.isFinite(tokenBudgetChars) || Number(tokenBudgetChars) <= 0)) {
  process.stderr.write('--token-budget-chars must be a positive number\n');
  process.exit(1);
}

const report = await runObjectiveEvalSuite({
  ...(tokenBudgetChars === undefined ? {} : { tokenBudgetChars }),
});

if (outputArg) {
  const outputDir = resolve(outputArg);
  await writeObjectiveEvalReport(outputDir, report);
}

if (hasFlag('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(renderObjectiveEvalMarkdown(report));
}

if (report.overall_status !== 'passed') {
  process.exit(1);
}
