import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { readProjectSettings } from '../core/settings/project-settings.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);

async function writeFakeLauncher(binDir: string, name: string, outputPath: string): Promise<void> {
  await writeFile(
    join(binDir, name),
    `#!/bin/sh\nprintf '%s\\n' \"$PWD\" > ${JSON.stringify(outputPath)}.cwd\nprintf '%s\\n' \"$@\" > ${JSON.stringify(outputPath)}.args\n`,
    { mode: 0o755 },
  );
}

test('ax --codex auto-onboards from input and launches Codex shell mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-codex-'));
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await writeFakeLauncher(binDir, 'codex', join(root, 'codex-launch'));

  const onboardingPath = join(root, 'onboarding.json');
  await writeFile(
    onboardingPath,
    JSON.stringify(
      {
        documents: [
          {
            label: 'Business Context',
            content: '# Business Context\n\nCodex shell onboarding fixture.\n',
          },
        ],
        onboardingContext: {
          business_context: 'Codex shell onboarding fixture.',
          policy_areas: ['auth'],
          architecture_summary: 'Monorepo with workers.',
          risky_domains: ['permissions'],
        },
        engineeringDefaults: {
          test_strategy: 'tdd',
          architecture: 'clean-boundaries',
          short_task_execution: 'subagent',
          long_task_execution: 'tmux',
          verification_commands: ['npm test', 'npm run build'],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', '--codex', '--root', root, '--lang', 'ko', '--onboarding-input', onboardingPath],
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let error = '';
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(error || `ax shell exited ${code}`));
      });
    });

    const settings = await readProjectSettings(root);
    const launchedCwd = await readFile(join(root, 'codex-launch.cwd'), 'utf8');
    const launchedArgs = await readFile(join(root, 'codex-launch.args'), 'utf8');
    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');

    assert.equal(settings?.locale, 'ko');
    assert.equal(settings?.preferred_platform, 'codex');
    assert.equal(launchedCwd.trim(), REPO_ROOT);
    assert.match(launchedArgs, /\/request/);
    assert.match(launchedArgs, /Shift AX .*셸 모드|Shift AX shell mode/i);
    assert.match(agents, /\/onboard/);
    assert.match(agents, /product-shell commands/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax with no args asks for language and platform, then runs guided onboarding before launching Codex', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-interactive-'));
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await writeFakeLauncher(binDir, 'codex', join(root, 'interactive-codex-launch'));

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', '--root', root],
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      let error = '';
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(error || `ax shell interactive exited ${code}`));
      });

      child.stdin.end(
        [
          '2',
          '1',
          '결제와 권한을 다루는 서비스입니다.',
          '사용자 결제 승인과 권한 검증 흐름을 처리합니다.',
          'auth, billing',
          'payments, permissions',
          '모놀리식 API와 작업 워커 구조입니다.',
          'src/payments, src/auth',
          'WalletCore, BillingGate',
          'npm test, npm run build',
        ].join('\n') + '\n',
      );
    });

    const settings = await readProjectSettings(root);
    const businessDoc = await readFile(join(root, 'docs', 'base-context', 'business-context.md'), 'utf8');
    const codexArgs = await readFile(join(root, 'interactive-codex-launch.args'), 'utf8');

    assert.equal(settings?.locale, 'ko');
    assert.equal(settings?.preferred_platform, 'codex');
    assert.match(businessDoc, /결제와 권한/);
    assert.match(codexArgs, /\/doctor/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax --claude-code launches Claude shell mode in the target repo cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-claude-'));
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await writeFakeLauncher(binDir, 'claude', join(root, 'claude-launch'));

  const onboardingPath = join(root, 'onboarding.json');
  await writeFile(
    onboardingPath,
    JSON.stringify(
      {
        documents: [
          {
            label: 'Architecture Overview',
            content: '# Architecture Overview\n\nClaude shell onboarding fixture.\n',
          },
        ],
        onboardingContext: {
          business_context: 'Claude shell onboarding fixture.',
          policy_areas: ['auth'],
          architecture_summary: 'Service and worker split.',
          risky_domains: ['permissions'],
        },
        engineeringDefaults: {
          test_strategy: 'tdd',
          architecture: 'clean-boundaries',
          short_task_execution: 'subagent',
          long_task_execution: 'tmux',
          verification_commands: ['npm test', 'npm run build'],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', '--claude-code', '--root', root, '--lang', 'en', '--onboarding-input', onboardingPath],
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let error = '';
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(error || `ax claude shell exited ${code}`));
      });
    });

    const launchedCwd = await readFile(join(root, 'claude-launch.cwd'), 'utf8');
    const launchedArgs = await readFile(join(root, 'claude-launch.args'), 'utf8');
    const claudeDoc = await readFile(join(root, 'CLAUDE.md'), 'utf8');

    assert.ok(launchedCwd.trim().endsWith(root));
    assert.match(launchedArgs, /\/status/);
    assert.match(claudeDoc, /\/onboard/);
    assert.match(claudeDoc, /product-shell commands/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('package bin exposes both ax and shift-ax for shell entry', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_URL, 'utf8')) as {
    bin: Record<string, string>;
  };

  assert.equal(packageJson.bin.ax, './dist/scripts/ax.js');
  assert.equal(packageJson.bin['shift-ax'], './dist/scripts/ax.js');
});
