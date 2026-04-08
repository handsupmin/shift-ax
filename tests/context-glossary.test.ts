import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractDomainGlossaryEntries,
  writeDomainGlossaryDocument,
} from '../core/context/glossary.js';

test('extractDomainGlossaryEntries proposes glossary terms from discovered docs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-glossary-'));

  try {
    await mkdir(join(root, 'docs', 'domain'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'domain', 'wallet-ledger.md'),
      [
        '# Wallet Ledger',
        '',
        'The Wallet Ledger stores LedgerEntry records for each WalletAccount.',
        'Settlement Batch processing writes SettlementBatch snapshots.',
        '',
      ].join('\n'),
      'utf8',
    );

    const entries = await extractDomainGlossaryEntries({
      rootDir: root,
      documentPaths: ['docs/domain/wallet-ledger.md'],
    });
    const terms = entries.map((entry) => entry.term);

    assert.ok(terms.includes('Wallet Ledger'));
    assert.ok(terms.includes('LedgerEntry'));
    assert.ok(terms.includes('WalletAccount'));
    assert.ok(terms.includes('SettlementBatch'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writeDomainGlossaryDocument writes a markdown glossary that can be linked from base-context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-glossary-doc-'));

  try {
    const result = await writeDomainGlossaryDocument({
      rootDir: root,
      entries: [
        {
          term: 'Wallet Ledger',
          definition: 'Stores append-only wallet records.',
          sources: ['docs/domain/wallet-ledger.md'],
        },
        {
          term: 'SettlementBatch',
          definition: 'Represents the batch settlement snapshot.',
          sources: ['docs/domain/wallet-ledger.md'],
        },
      ],
    });

    const content = await readFile(join(root, result.path), 'utf8');
    assert.match(content, /# Domain Glossary/);
    assert.match(content, /Wallet Ledger/);
    assert.match(content, /SettlementBatch/);
    assert.match(content, /docs\/domain\/wallet-ledger\.md/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
