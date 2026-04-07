import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseIndexDocument } from '../core/context/index-resolver.js';
import {
  authorBaseContextIndex,
  renderIndexDocument,
} from '../core/context/index-authoring.js';

test('renderIndexDocument writes markdown bullets for tracked docs', () => {
  const markdown = renderIndexDocument([
    { label: 'Auth policy', path: 'docs/base-context/auth-policy.md' },
    { label: 'Wallet domain', path: 'docs/base-context/wallet-domain.md' },
  ]);

  assert.match(markdown, /# Base Context Index/);
  assert.match(markdown, /- Auth policy -> docs\/base-context\/auth-policy.md/);
  assert.match(markdown, /- Wallet domain -> docs\/base-context\/wallet-domain.md/);
});

test('authorBaseContextIndex merges new entries without dropping unrelated ones', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-index-authoring-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      [
        '# Base Context Index',
        '',
        '- Existing domain -> docs/base-context/existing-domain.md',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = await authorBaseContextIndex({
      rootDir: root,
      entries: [
        { label: 'Auth policy', path: 'docs/base-context/auth-policy.md' },
      ],
    });

    const index = await readFile(result.indexPath, 'utf8');
    const entries = parseIndexDocument(index);

    assert.deepEqual(entries, [
      { label: 'Existing domain', path: 'docs/base-context/existing-domain.md' },
      { label: 'Auth policy', path: 'docs/base-context/auth-policy.md' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
