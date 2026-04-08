import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { discoverBaseContextEntries } from '../core/context/discovery.js';

test('discoverBaseContextEntries proposes index entries from relevant docs and ignores noise', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-discovery-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await mkdir(join(root, 'docs', 'policies'), { recursive: true });
    await mkdir(join(root, 'docs', 'domain'), { recursive: true });
    await mkdir(join(root, 'docs', 'verification'), { recursive: true });
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });

    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nArchitecture details.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'policies', 'auth-policy.md'),
      '# Auth Policy\n\nRotation is required.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'domain', 'payment-ledger.md'),
      '# Payment Ledger\n\nAppend-only ledger rules.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'verification', 'smoke-log.md'),
      '# Smoke Log\n\nNoise.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n',
      'utf8',
    );

    const entries = await discoverBaseContextEntries({ rootDir: root });
    const labels = entries.map((entry) => entry.label);
    const paths = entries.map((entry) => entry.path);

    assert.deepEqual(labels.sort(), ['Auth Policy', 'Payment Ledger', 'System Overview']);
    assert.deepEqual(
      paths.sort(),
      [
        'docs/architecture/system-overview.md',
        'docs/domain/payment-ledger.md',
        'docs/policies/auth-policy.md',
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
