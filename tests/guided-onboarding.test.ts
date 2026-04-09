import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runGuidedOnboarding } from '../core/context/guided-onboarding.js';

test('runGuidedOnboarding writes guided docs and merges discovered docs when requested', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-guided-onboarding-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nThe service is split into auth and ledger domains.\n',
      'utf8',
    );

    const answers = [
      'y',
      'Wallet platform for B2B finance.',
      'It handles wallet funding and settlement workflows.',
      'auth, billing',
      'payments, permissions',
      'Monorepo with API and worker services.',
      'api, workers',
      'LedgerX, WalletCore',
      'npm test, npm run build',
    ];

    const result = await runGuidedOnboarding({
      rootDir: root,
      locale: 'en',
      ask: async () => answers.shift() ?? '',
    });

    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const business = await readFile(join(root, 'docs', 'base-context', 'business-context.md'), 'utf8');
    const glossary = await readFile(join(root, 'docs', 'base-context', 'domain-glossary.md'), 'utf8');

    assert.ok(result.documents.some((doc) => doc.path === 'docs/architecture/system-overview.md'));
    assert.ok(result.documents.some((doc) => doc.path === 'docs/base-context/business-context.md'));
    assert.match(index, /System Overview -> docs\/architecture\/system-overview.md/);
    assert.match(index, /Business Context -> docs\/base-context\/business-context.md/);
    assert.match(business, /wallet funding and settlement workflows/i);
    assert.match(glossary, /LedgerX/);
    assert.match(glossary, /WalletCore/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
