import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeContextMonitorSnapshot } from '../core/observability/context-monitor.js';

test('writeContextMonitorSnapshot writes a machine-readable warning snapshot for hooks or operators', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-monitor-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'audit-policy.md'),
      '# Audit Policy\n\n' + 'refund traceability '.repeat(300),
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n- Audit Policy -> docs/base-context/audit-policy.md\n',
      'utf8',
    );

    const result = await writeContextMonitorSnapshot({
      rootDir: root,
      query: 'refund traceability',
      maxChars: 500,
    });

    const content = JSON.parse(await readFile(result.output_path, 'utf8')) as {
      status: string;
      should_pause: boolean;
    };
    assert.equal(content.status, 'critical');
    assert.equal(content.should_pause, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
