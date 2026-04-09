import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runGuidedOnboarding } from '../core/context/guided-onboarding.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('runGuidedOnboarding writes the global work-type/repository/domain-language structure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-guided-onboarding-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nThe service is split into auth and ledger domains.\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-guided-home-', async (home) => {
      const answers = [
        '',
        'I build wallet APIs and settlement flows.',
        'API development',
        'Create controller, service, dto, and tests together.',
        'wallet-platform',
        '',
        'Wallet API repo',
        'docs/architecture, src/controllers',
        'Looks right but migrations happen elsewhere.',
        'For API work I update controllers/services/DTOs and then add regression tests.',
        'LedgerX, WalletCore',
        'Internal ledger service.',
        'Core wallet bounded context.',
        'npm test, npm run build',
        '',
      ];

      const result = await runGuidedOnboarding({
        rootDir: root,
        locale: 'en',
        ask: async () => answers.shift() ?? '',
      });

      const index = await readFile(join(home, 'index.md'), 'utf8');
      const workType = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const glossary = await readFile(join(home, 'domain-language', 'ledgerx.md'), 'utf8');

      assert.ok(result.documents.some((doc) => doc.path === 'work-types/api-development.md'));
      assert.match(index, /API development -> work-types\/api-development.md/);
      assert.match(workType, /wallet-platform/i);
      assert.match(glossary, /Internal ledger service/);
      assert.match(await readFile(join(home, 'domain-language', 'walletcore.md'), 'utf8'), /bounded context/i);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
