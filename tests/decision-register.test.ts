import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  listDecisionRecords,
  recordDecision,
  replaceDecision,
} from '../core/memory/decision-register.js';

test('recordDecision stores a decision with validity metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-register-'));

  try {
    const decision = await recordDecision({
      rootDir: root,
      title: 'Use session cookies for auth',
      summary: 'Prefer session cookies over JWT for first-party web flows.',
      category: 'architecture',
      validFrom: '2026-04-08',
      sourceTopic: '2026-04-08-auth-refresh',
      sourceDoc: 'docs/base-context/auth-policy.md',
    });

    const records = await listDecisionRecords({ rootDir: root });

    assert.equal(records.length, 1);
    assert.equal(decision.title, 'Use session cookies for auth');
    assert.equal(records[0]?.valid_from, '2026-04-08');
    assert.equal(records[0]?.source_topic, '2026-04-08-auth-refresh');
    assert.equal(records[0]?.status, 'active');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('replaceDecision closes the previous decision and records the replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-replace-'));

  try {
    const first = await recordDecision({
      rootDir: root,
      title: 'Use session cookies for auth',
      summary: 'Prefer session cookies over JWT for first-party web flows.',
      category: 'architecture',
      validFrom: '2026-04-08',
    });

    const second = await replaceDecision({
      rootDir: root,
      replacedDecisionId: first.id,
      title: 'Use rotating session cookies for auth',
      summary: 'Tighten auth with rotating cookies and shorter refresh windows.',
      category: 'architecture',
      validFrom: '2026-05-01',
    });

    const records = await listDecisionRecords({ rootDir: root });
    const replaced = records.find((record) => record.id === first.id);
    const replacement = records.find((record) => record.id === second.id);

    assert.equal(records.length, 2);
    assert.equal(replaced?.status, 'superseded');
    assert.equal(replaced?.valid_to, '2026-05-01');
    assert.equal(replaced?.replaced_by, second.id);
    assert.equal(replacement?.status, 'active');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('listDecisionRecords can filter to active decisions for a given date', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-active-'));

  try {
    const first = await recordDecision({
      rootDir: root,
      title: 'Use session cookies for auth',
      summary: 'Prefer session cookies over JWT for first-party web flows.',
      category: 'architecture',
      validFrom: '2026-04-08',
    });
    await replaceDecision({
      rootDir: root,
      replacedDecisionId: first.id,
      title: 'Use rotating session cookies for auth',
      summary: 'Tighten auth with rotating cookies and shorter refresh windows.',
      category: 'architecture',
      validFrom: '2026-05-01',
    });

    const april = await listDecisionRecords({ rootDir: root, activeAt: '2026-04-20' });
    const may = await listDecisionRecords({ rootDir: root, activeAt: '2026-05-10' });

    assert.equal(april.length, 1);
    assert.match(april[0]?.title ?? '', /session cookies/);
    assert.equal(may.length, 1);
    assert.match(may[0]?.title ?? '', /rotating session cookies/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
