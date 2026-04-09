import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { applyGlobalKnowledgeUpdatesFromArtifacts } from '../core/context/global-knowledge-updates.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('applyGlobalKnowledgeUpdatesFromArtifacts backs up and updates stable global docs', async () => {
  await withTempGlobalHome('shift-ax-global-updates-home-', async (home) => {
    try {
      await mkdir(join(home, 'work-types'), { recursive: true });
      await writeFile(
        join(home, 'index.md'),
        '# Shift AX Global Index\n\n## Work Types\n\n- API development -> work-types/api-development.md\n\n## Domain Language\n\n- None yet.\n',
        'utf8',
      );
      await writeFile(
        join(home, 'work-types', 'api-development.md'),
        '# API development\n\nOld workflow.\n',
        'utf8',
      );

      const updates = await applyGlobalKnowledgeUpdatesFromArtifacts({
        brainstormContent: [
          '# Brainstorm',
          '',
          '## Global Knowledge Updates',
          '',
          '- work-type: API development -> Create controller/service/DTO changes together and add tests first.',
          '- domain-language: LedgerX -> Internal append-only ledger service.',
          '- procedure: payments-api -> This volatile repo-only workflow should not auto-promote.',
          '',
        ].join('\n'),
      });

      const updatedWorkType = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const domainTerm = await readFile(join(home, 'domain-language', 'ledgerx.md'), 'utf8');
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const backups = await readdir(join(home, 'backups'));

      assert.equal(updates.length, 2);
      assert.match(updatedWorkType, /controller\/service\/DTO/i);
      assert.match(domainTerm, /append-only ledger service/i);
      assert.match(index, /LedgerX -> domain-language\/ledgerx.md/);
      assert.ok(backups.some((name) => name.endsWith('api-development.md')));
      assert.ok(backups.some((name) => name.endsWith('index.md')));
      assert.equal(backups.some((name) => name.includes('payments-api')), false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
