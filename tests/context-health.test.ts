import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { assessContextHealth } from '../core/observability/context-health.js';

test('assessContextHealth reports ok when the bundle comfortably fits inside the budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-health-ok-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'audit-policy.md'),
      '# Audit Policy\n\nRefund changes must preserve customer-visible traceability.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n- Audit Policy -> docs/base-context/audit-policy.md\n',
      'utf8',
    );

    const result = await assessContextHealth({
      rootDir: root,
      query: 'refund traceability',
      maxChars: 4000,
    });

    assert.equal(result.status, 'ok');
    assert.equal(result.bundle.truncated, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('assessContextHealth reports critical when the raw context far exceeds the current bundle budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-health-critical-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    const large = '# Audit Policy\n\n' + 'refund traceability '.repeat(500);
    await writeFile(join(root, 'docs', 'base-context', 'audit-policy.md'), large, 'utf8');
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n- Audit Policy -> docs/base-context/audit-policy.md\n',
      'utf8',
    );

    const result = await assessContextHealth({
      rootDir: root,
      query: 'refund traceability',
      maxChars: 500,
    });

    assert.equal(result.status, 'critical');
    assert.equal(result.bundle.truncated, true);
    assert.match(result.recommendation, /split|pause|bundle/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
