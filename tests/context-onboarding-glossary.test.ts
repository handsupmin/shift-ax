import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContextFromDiscovery } from '../core/context/onboarding.js';

test('onboardProjectContextFromDiscovery can generate a domain glossary and link it in the index', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboard-glossary-'));

  try {
    await mkdir(join(root, 'docs', 'domain'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'domain', 'wallet-ledger.md'),
      [
        '# Wallet Ledger',
        '',
        'The Wallet Ledger stores LedgerEntry records for each WalletAccount.',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = await onboardProjectContextFromDiscovery({
      rootDir: root,
      includeGlossary: true,
    });
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const glossary = await readFile(join(root, 'docs', 'base-context', 'domain-glossary.md'), 'utf8');

    assert.ok(result.documents.some((doc) => doc.path === 'docs/base-context/domain-glossary.md'));
    assert.match(index, /Domain Glossary -> docs\/base-context\/domain-glossary\.md/);
    assert.match(glossary, /Wallet Ledger/);
    assert.match(glossary, /LedgerEntry/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
