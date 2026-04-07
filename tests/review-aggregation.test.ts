import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  REQUIRED_REVIEW_LANES,
  aggregateReviewVerdicts,
  renderReviewSummaryMarkdown,
} from '../core/review/aggregate-reviews.js';

test('aggregateReviewVerdicts blocks when required lanes are missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-review-missing-'));
  const reviewDir = join(root, 'review');

  try {
    await mkdir(reviewDir, { recursive: true });
    await writeFile(
      join(reviewDir, 'domain-policy.json'),
      JSON.stringify(
        {
          version: 1,
          lane: 'domain-policy',
          status: 'approved',
          checked_at: new Date().toISOString(),
          summary: 'Domain policy is satisfied.',
        },
        null,
        2,
      ),
      'utf8',
    );

    const result = await aggregateReviewVerdicts({ topicDir: root });

    assert.equal(result.overall_status, 'blocked');
    assert.equal(result.commit_allowed, false);
    assert.equal(result.next_stage, 'implementation');
    assert.deepEqual(result.approved_lanes, ['domain-policy']);
    assert.equal(result.missing_lanes.length, REQUIRED_REVIEW_LANES.length - 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('aggregateReviewVerdicts approves when all required lanes approve', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-review-approved-'));
  const reviewDir = join(root, 'review');

  try {
    await mkdir(reviewDir, { recursive: true });

    for (const lane of REQUIRED_REVIEW_LANES) {
      await writeFile(
        join(reviewDir, `${lane}.json`),
        JSON.stringify(
          {
            version: 1,
            lane,
            status: 'approved',
            checked_at: new Date().toISOString(),
            summary: `${lane} approved`,
          },
          null,
          2,
        ),
        'utf8',
      );
    }

    const result = await aggregateReviewVerdicts({ topicDir: root });

    assert.equal(result.overall_status, 'approved');
    assert.equal(result.commit_allowed, true);
    assert.equal(result.next_stage, 'finalization');
    assert.deepEqual(result.missing_lanes, []);
    assert.deepEqual(result.approved_lanes.sort(), [...REQUIRED_REVIEW_LANES].sort());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('renderReviewSummaryMarkdown produces gate-first readable output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-review-summary-'));
  const reviewDir = join(root, 'review');

  try {
    await mkdir(reviewDir, { recursive: true });
    await writeFile(
      join(reviewDir, 'domain-policy.json'),
      JSON.stringify(
        {
          version: 1,
          lane: 'domain-policy',
          status: 'approved',
          checked_at: new Date().toISOString(),
          summary: 'Domain policy is satisfied.',
        },
        null,
        2,
      ),
      'utf8',
    );

    const result = await aggregateReviewVerdicts({ topicDir: root });
    const summary = renderReviewSummaryMarkdown(result);

    assert.match(summary, /# Review Summary/);
    assert.match(summary, /Overall Status: blocked/);
    assert.match(summary, /Next Stage: implementation/);
    assert.match(summary, /Missing Lanes/);
    assert.match(summary, /spec-conformance/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
