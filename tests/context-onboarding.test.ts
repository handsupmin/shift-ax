import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { readProjectProfile } from '../core/policies/project-profile.js';

test('onboardProjectContext writes docs, index, and project profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboarding-'));

  try {
    const result = await onboardProjectContext({
      rootDir: root,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
        {
          label: 'Wallet domain',
          content: '# Wallet Domain\n\nBalance updates are append-only.\n',
        },
      ],
      engineeringDefaults: {
        test_strategy: 'tdd',
        architecture: 'clean-boundaries',
        short_task_execution: 'subagent',
        long_task_execution: 'tmux',
      },
      onboardingContext: {
        business_context: 'B2B fintech operations platform.',
        policy_areas: ['auth', 'billing'],
        architecture_summary: 'Service boundaries around auth and ledger.',
        risky_domains: ['payments'],
      },
    });

    const authDoc = await readFile(join(root, 'docs', 'base-context', 'auth-policy.md'), 'utf8');
    const walletDoc = await readFile(
      join(root, 'docs', 'base-context', 'wallet-domain.md'),
      'utf8',
    );
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');
    const profile = await readProjectProfile(root);

    assert.match(authDoc, /Refresh token rotation is required/);
    assert.match(walletDoc, /append-only/);
    assert.match(index, /Auth policy -> docs\/base-context\/auth-policy.md/);
    assert.match(index, /Wallet domain -> docs\/base-context\/wallet-domain.md/);
    assert.equal(result.documents.length, 2);
    assert.ok(profile);
    assert.equal(profile?.engineering_defaults.test_strategy, 'tdd');
    assert.equal(profile?.engineering_defaults.short_task_execution, 'subagent');
    assert.equal(profile?.context_docs.length, 2);
    assert.equal(profile?.onboarding_context?.policy_areas[1], 'billing');
    assert.match(profile?.onboarding_context?.business_context ?? '', /fintech/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
