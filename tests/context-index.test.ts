import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  parseIndexDocument,
  resolveContextFromIndex,
} from '../core/context/index-resolver.js';

test('parseIndexDocument reads markdown bullets with labels and paths', () => {
  const entries = parseIndexDocument(`
# Service Index

- Auth policy -> docs/policies/auth.md
- Payments runbook -> docs/domain/payments.md
`);

  assert.deepEqual(entries, [
    { label: 'Auth policy', path: 'docs/policies/auth.md' },
    { label: 'Payments runbook', path: 'docs/domain/payments.md' },
  ]);
});

test('resolveContextFromIndex returns matched docs and loaded content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-'));

  try {
    await mkdir(join(root, 'docs', 'policies'), { recursive: true });
    await mkdir(join(root, 'docs', 'domain'), { recursive: true });

    const indexPath = join(root, 'docs', 'service-index.md');
    await writeFile(
      indexPath,
      [
        '# Service Index',
        '',
        '- Auth policy -> docs/policies/auth.md',
        '- Wallet domain -> docs/domain/wallet.md',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'policies', 'auth.md'),
      '# Auth Policy\n\nRefresh token rotation is required.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'domain', 'wallet.md'),
      '# Wallet Domain\n\nWallet balance rules live here.\n',
      'utf8',
    );

    const result = await resolveContextFromIndex({
      rootDir: root,
      indexPath,
      query: 'Design an auth refresh token rotation flow',
      maxMatches: 2,
    });

    assert.equal(result.index_path, indexPath);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0]!.label, 'Auth policy');
    assert.match(result.matches[0]!.content, /Refresh token rotation is required/);
    assert.deepEqual(result.unresolved_paths, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
