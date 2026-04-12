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
    await mkdir(join(root, 'src', 'controllers'), { recursive: true });
    await mkdir(join(root, 'src', 'services'), { recursive: true });
    await mkdir(join(root, 'src', 'dto'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nThe service is split into auth and ledger domains.\n',
      'utf8',
    );
    await writeFile(
      join(root, 'src', 'controllers', 'wallet-controller.ts'),
      'export async function walletController() { return "ok"; }\n',
      'utf8',
    );
    await writeFile(
      join(root, 'src', 'services', 'wallet-service.ts'),
      'export async function walletService() { return "ok"; }\n',
      'utf8',
    );
    await writeFile(
      join(root, 'src', 'dto', 'wallet-dto.ts'),
      'export interface WalletDto { id: string }\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-guided-home-', async (home) => {
      const prompts: string[] = [];
      const answers = [
        '',
        'I build wallet APIs and settlement flows.',
        'API development',
        'I usually change API boundaries and follow the architecture docs.',
        'wallet-platform',
        '',
        '1',
        '',
        '',
        '',
        '',
        'n',
        'n',
        'LedgerX',
        'Internal ledger service.',
        'n',
        'npm test, npm run build',
      ];

      const result = await runGuidedOnboarding({
        rootDir: root,
        locale: 'en',
        ask: async (question) => {
          prompts.push(question);
          return answers.shift() ?? '';
        },
      });

      const index = await readFile(join(home, 'index.md'), 'utf8');
      const workType = await readFile(join(home, 'work-types', 'api-development.md'), 'utf8');
      const procedure = await readFile(join(home, 'procedures', 'api-development--wallet-platform.md'), 'utf8');
      const glossary = await readFile(join(home, 'domain-language', 'ledgerx.md'), 'utf8');

      assert.ok(result.documents.some((doc) => doc.path === 'work-types/api-development.md'));
      assert.match(index, /API development -> work-types\/api-development.md/);
      assert.match(workType, /wallet-platform/i);
      assert.match(procedure, /Hidden Conventions and Layer Intent/);
      assert.match(procedure, /controller\/service/i);
      assert.match(glossary, /Internal ledger service/);
      assert.ok(
        prompts.some((prompt) => prompt.includes('This step matters most') && prompt.includes('accurate')),
      );
      assert.ok(prompts.some((prompt) => prompt.includes('What is one core kind of work')));
      assert.ok(prompts.some((prompt) => prompt.includes('Choose one:') && prompt.includes('1.') && prompt.includes('3.')));
      assert.ok(prompts.every((prompt) => !prompt.includes('comma-separated')));
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runGuidedOnboarding accepts Korean overwrite confirmation when knowledge already exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-guided-onboarding-ko-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nControllers delegate to services.\n',
      'utf8',
    );

    await withTempGlobalHome('shift-ax-guided-home-ko-', async (home) => {
      await writeFile(join(home, 'index.md'), '# Existing Index\n', 'utf8');

      const answers = [
        '',
        '결제 API를 관리합니다.',
        'API 개발',
        '아키텍처 문서를 보고 API 변경을 진행합니다.',
        'wallet-platform',
        '',
        '1',
        '',
        '',
        '',
        '',
        'n',
        '',
        '',
        'npm test, npm run build',
        '네',
      ];

      const result = await runGuidedOnboarding({
        rootDir: root,
        locale: 'ko',
        ask: async () => answers.shift() ?? '',
      });

      const index = await readFile(join(home, 'index.md'), 'utf8');
      assert.ok(result.documents.some((doc) => doc.path === 'work-types/api.md'));
      assert.match(index, /API 개발 -> work-types\/api.md/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
