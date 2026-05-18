import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runObjectiveEvalSuite } from '../core/evaluation/objective-eval.js';

test('objective eval suite reports request-to-commit quality and token metrics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-objective-eval-test-'));

  try {
    const outputDir = join(root, 'report');
    const report = await runObjectiveEvalSuite({
      outputDir,
      tokenBudgetChars: 1200,
      now: new Date('2026-05-18T00:00:00.000Z'),
    });

    assert.equal(report.overall_status, 'passed');
    assert.equal(report.failed_metrics, 0);
    assert.ok(report.metric_count >= 18);
    assert.equal(existsSync(join(outputDir, 'objective-eval-report.json')), true);
    assert.equal(existsSync(join(outputDir, 'objective-eval-report.md')), true);

    const metricIds = new Set(report.scenarios.flatMap((scenario) => scenario.metrics.map((metric) => metric.id)));
    assert.equal(metricIds.has('review.decision_accuracy'), true);
    assert.equal(metricIds.has('harness.invalid_transition_rejection'), true);
    assert.equal(metricIds.has('token.reduction_pct'), true);
    assert.equal(metricIds.has('artifact.completeness'), true);

    const markdown = await readFile(join(outputDir, 'objective-eval-report.md'), 'utf8');
    assert.match(markdown, /Shift AX Objective Eval Report/);
    assert.match(markdown, /token\.reduction_pct/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax eval CLI emits machine-readable objective metrics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-objective-eval-cli-'));

  try {
    const outputDir = join(root, 'report');
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', 'eval', '--output', outputDir, '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    const report = JSON.parse(stdout) as {
      overall_status: string;
      failed_metrics: number;
      scenarios: Array<{ id: string }>;
    };

    assert.equal(report.overall_status, 'passed');
    assert.equal(report.failed_metrics, 0);
    assert.ok(report.scenarios.some((scenario) => scenario.id === 'review-gates'));
    assert.equal(existsSync(join(outputDir, 'objective-eval-report.json')), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
