import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { readProjectProfile } from '../core/policies/project-profile.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('onboardProjectContext writes global docs, index, and profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-'));

  try {
    await withTempGlobalHome('shift-ax-onboarding-home-', async (home) => {
      const result = await onboardProjectContext({
        rootDir: root,
        primaryRoleSummary: 'I mainly build wallet APIs and ledger workflows.',
        workTypes: [
          {
            name: 'API development',
            summary: 'I add controllers, services, DTOs, and tests.',
            repositories: [
              {
                repository: 'wallet-api',
                repositoryPath: root,
                purpose: 'Wallet operations API',
                directories: ['src/controllers', 'src/services', 'src/dto'],
                workflow:
                  'Create controller/service/DTO changes together, then add request and service tests.',
                inferredNotes: ['Controller and service boundaries appear to exist.'],
                confirmationNotes: 'Confirmed by the user.',
                volatility: 'stable',
              },
            ],
          },
        ],
        domainLanguage: [
          {
            term: 'LedgerX',
            definition: 'Internal append-only ledger service.',
          },
        ],
        engineeringDefaults: {
          test_strategy: 'tdd',
          architecture: 'clean-boundaries',
          short_task_execution: 'subagent',
          long_task_execution: 'tmux',
        },
      });

      const workTypeDoc = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const procedureDoc = await readFile(join(home, 'procedures', 'api-development--wallet-api.md'), 'utf8');
      const glossaryDoc = await readFile(join(home, 'domain-language', 'ledgerx.md'), 'utf8');
      const index = await readFile(join(home, 'index.md'), 'utf8');
      const profile = await readProjectProfile(root);

      assert.match(workTypeDoc, /wallet-api/);
      assert.match(procedureDoc, /controller\/service\/DTO/i);
      assert.match(glossaryDoc, /append-only ledger service/i);
      assert.match(index, /API development -> work-types\/api-development.md/);
      assert.match(index, /LedgerX -> domain-language\/ledgerx.md/);
      assert.equal(result.documents.length >= 3, true);
      assert.ok(profile);
      assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
      assert.equal(profile?.engineering_defaults.short_task_execution, 'subagent');
      assert.equal(profile?.context_docs.some((entry) => entry.path === 'work-types/api-development.md'), true);
      assert.equal(profile?.onboarding_context?.work_types[0], 'API development');
      assert.match(profile?.onboarding_context?.primary_role_summary ?? '', /wallet APIs/i);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
