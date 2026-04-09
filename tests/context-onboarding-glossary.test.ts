import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContextFromDiscovery } from '../core/context/onboarding.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('onboardProjectContextFromDiscovery can migrate discovered docs into global domain-language pages', async () => {
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

    await withTempGlobalHome('shift-ax-glossary-home-', async (home) => {
      const result = await onboardProjectContextFromDiscovery({
        rootDir: root,
        includeGlossary: true,
      });
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const glossary = await readFile(join(home, 'domain-language', 'wallet-ledger.md'), 'utf8');

      assert.ok(result.documents.some((doc) => doc.path === 'domain-language/wallet-ledger.md'));
      assert.match(index, /Wallet Ledger -> domain-language\/wallet-ledger\.md/);
      assert.match(glossary, /Migrated from docs\/domain\/wallet-ledger.md/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
