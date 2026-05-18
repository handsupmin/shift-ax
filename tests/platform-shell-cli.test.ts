import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { readProjectSettings } from '../core/settings/project-settings.js';
import { withTempGlobalHome } from './helpers/global-home.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);

async function writeFakeLauncher(binDir: string, name: string, outputPath: string): Promise<void> {
  await writeFile(
    join(binDir, name),
    `#!/bin/sh\nprintf '%s\\n' \"$PWD\" > ${JSON.stringify(outputPath)}.cwd\nprintf '%s\\n' \"$@\" > ${JSON.stringify(outputPath)}.args\n`,
    { mode: 0o755 },
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('shift-ax --codex with explicit onboarding input still onboards before launch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-codex-'));
  const runtimeHome = join(root, 'home');
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(join(root, '.codex', 'skills', 'request'), { recursive: true });
  await mkdir(join(root, '.codex', 'skills', 'resume'), { recursive: true });
  await mkdir(join(root, '.codex', 'prompts'), { recursive: true });
  await writeFile(join(root, '.codex', 'skills', 'request', 'SKILL.md'), 'Legacy Shift AX request skill', 'utf8');
  await writeFile(join(root, '.codex', 'skills', 'resume', 'SKILL.md'), 'Legacy Shift AX resume skill', 'utf8');
  await writeFile(join(root, '.codex', 'prompts', 'shift-ax-bootstrap.md'), 'Legacy Shift AX prompt', 'utf8');
  await mkdir(runtimeHome, { recursive: true });
  await writeFakeLauncher(binDir, 'codex', join(root, 'codex-launch'));

  const onboardingPath = join(root, 'onboarding.json');
  await writeFile(
    onboardingPath,
    JSON.stringify(
      {
        primaryRoleSummary: 'Codex shell onboarding fixture.',
        workTypes: [
          {
            name: 'API development',
            summary: 'Build APIs in the shell fixture.',
            repositories: [
              {
                repository: 'codex-shell',
                repositoryPath: root,
                purpose: 'Shell fixture repo',
                directories: ['src/api'],
                workflow: 'Update API files and tests together.',
              },
            ],
          },
        ],
        domainLanguage: [{ term: 'WalletCore', definition: 'Fixture domain term.' }],
        onboardingContext: {
          primary_role_summary: 'Codex shell onboarding fixture.',
          work_types: ['API development'],
          domain_language: ['WalletCore'],
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
    await withTempGlobalHome('shift-ax-shell-codex-home-', async (home) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--codex', '--root', root, '--lang', 'ko', '--onboarding-input', onboardingPath],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax shell exited ${code}`));
        });
      });

      const settings = await readProjectSettings(root);
      const launchedCwd = await readFile(join(root, 'codex-launch.cwd'), 'utf8');
      const launchedArgs = await readFile(join(root, 'codex-launch.args'), 'utf8');
      const prompt = await readFile(join(runtimeHome, '.codex', 'prompts', 'shift-ax-bootstrap.md'), 'utf8');
      const requestCommand = await readFile(join(runtimeHome, '.codex', 'skills', 'request', 'SKILL.md'), 'utf8');

      assert.equal(settings?.locale, 'ko');
      assert.equal(settings?.preferred_language, 'korean');
      assert.equal(settings?.default_full_auto, false);
      assert.equal(settings?.preferred_platform, 'codex');
      assert.equal(launchedCwd.trim(), REPO_ROOT);
      assert.doesNotMatch(launchedArgs, /\/request|Shift AX .*셸 모드|Shift AX shell mode/i);
      assert.match(prompt, /\$onboard/);
      assert.match(prompt, /한국어로 응답하세요/);
      assert.match(prompt, /visible product-shell commands/);
      assert.match(requestCommand, /Start a new Shift AX request-to-commit flow/);
      assert.equal(await pathExists(join(root, 'AGENTS.md')), false);
      assert.equal(await pathExists(join(root, '.codex', 'skills', 'request', 'SKILL.md')), false);
      assert.equal(await pathExists(join(root, '.codex', 'skills', 'resume', 'SKILL.md')), false);
      assert.equal(await pathExists(join(root, '.codex', 'prompts', 'shift-ax-bootstrap.md')), false);
      assert.equal(await pathExists(join(runtimeHome, '.codex', 'skills', 'resume', 'SKILL.md')), false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('shift-ax with no args asks for language once, stores it globally, then launches codex without a startup prompt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-interactive-'));
  const runtimeHome = join(root, 'home');
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeFakeLauncher(binDir, 'codex', join(root, 'interactive-codex-launch'));

  try {
    await withTempGlobalHome('shift-ax-shell-interactive-home-', async (home) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--root', root],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax shell interactive exited ${code}`));
        });
        child.stdin.end('2\n2\n');
      });

      const codexArgs = await readFile(join(root, 'interactive-codex-launch.args'), 'utf8');
      const settings = await readProjectSettings(root);
      const requestCommand = await readFile(join(runtimeHome, '.codex', 'skills', 'request', 'SKILL.md'), 'utf8');

      assert.equal(settings?.locale, 'ko');
      assert.equal(settings?.preferred_language, 'korean');
      assert.equal(settings?.default_full_auto, true);
      assert.equal(settings?.preferred_platform, 'codex');
      assert.match(codexArgs, /--yolo/);
      assert.doesNotMatch(codexArgs, /No global Shift AX profile was found yet|\$onboard/i);
      assert.match(requestCommand, /allow-missing-global-context/);
      assert.equal(await pathExists(join(root, '.codex', 'skills', 'request', 'SKILL.md')), false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('shift-ax --codex installs runtime skills globally and cleans ancestor-local Shift AX duplicates', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shift-ax-shell-global-scope-'));
  const runtimeHome = join(sandbox, 'home');
  const root = join(runtimeHome, 'sources', 'app');
  const ancestor = join(runtimeHome, 'sources');
  const binDir = join(sandbox, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(root, { recursive: true });
  await mkdir(join(ancestor, '.codex', 'skills', 'request'), { recursive: true });
  await mkdir(join(ancestor, '.codex', 'skills', 'resume'), { recursive: true });
  await mkdir(join(ancestor, '.codex', 'skills', 'gc-onboard'), { recursive: true });
  await writeFile(join(ancestor, '.codex', 'skills', 'request', 'SKILL.md'), 'Legacy Shift AX request skill', 'utf8');
  await writeFile(join(ancestor, '.codex', 'skills', 'resume', 'SKILL.md'), 'Legacy Shift AX resume skill', 'utf8');
  await writeFile(join(ancestor, '.codex', 'skills', 'gc-onboard', 'SKILL.md'), 'GCTree skill owned by another tool', 'utf8');
  await writeFakeLauncher(binDir, 'codex', join(sandbox, 'codex-global-scope-launch'));

  try {
    await withTempGlobalHome('shift-ax-shell-global-scope-home-', async (home) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--codex', '--root', root, '--lang', 'en'],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax global scope shell exited ${code}`));
        });
      });

      assert.equal(await pathExists(join(runtimeHome, '.codex', 'skills', 'request', 'SKILL.md')), true);
      assert.equal(await pathExists(join(runtimeHome, '.codex', 'skills', 'resume', 'SKILL.md')), false);
      assert.equal(await pathExists(join(ancestor, '.codex', 'skills', 'request', 'SKILL.md')), false);
      assert.equal(await pathExists(join(ancestor, '.codex', 'skills', 'resume', 'SKILL.md')), false);
      assert.equal(await pathExists(join(ancestor, '.codex', 'skills', 'gc-onboard', 'SKILL.md')), true);
      assert.equal(await pathExists(join(root, '.codex', 'skills', 'request', 'SKILL.md')), false);
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shift-ax --claude-code asks for language before launch and starts cleanly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-claude-bootstrap-'));
  const runtimeHome = join(root, 'home');
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeFakeLauncher(binDir, 'claude', join(root, 'claude-bootstrap-launch'));

  try {
    await withTempGlobalHome('shift-ax-shell-claude-home-', async (home) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--claude-code', '--root', root],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax claude bootstrap shell exited ${code}`));
        });
        child.stdin.end('1\n2\n');
      });

      const settings = await readProjectSettings(root);
      const launchedArgs = await readFile(join(root, 'claude-bootstrap-launch.args'), 'utf8');
      const requestCommand = await readFile(join(runtimeHome, '.claude', 'commands', 'request.md'), 'utf8');

      assert.equal(settings?.locale, 'en');
      assert.equal(settings?.preferred_language, 'english');
      assert.equal(settings?.default_full_auto, true);
      assert.equal(settings?.preferred_platform, 'claude-code');
      assert.match(launchedArgs, /--dangerously-skip-permissions/);
      assert.match(requestCommand, /\$ARGUMENTS/);
      assert.equal(await pathExists(join(root, '.claude', 'commands', 'request.md')), false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('shift-ax --claude-code with explicit onboarding input launches Claude shell mode in the target repo cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-claude-'));
  const runtimeHome = join(root, 'home');
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeFakeLauncher(binDir, 'claude', join(root, 'claude-launch'));

  const onboardingPath = join(root, 'onboarding.json');
  await writeFile(
    onboardingPath,
    JSON.stringify(
      {
        primaryRoleSummary: 'Claude shell onboarding fixture.',
        workTypes: [
          {
            name: 'API development',
            summary: 'Build APIs and worker hooks.',
            repositories: [
              {
                repository: 'claude-shell',
                repositoryPath: root,
                purpose: 'Shell fixture repo',
                directories: ['src/api'],
                workflow: 'Update API files and tests together.',
              },
            ],
          },
        ],
        domainLanguage: [{ term: 'ClaudeShell', definition: 'Fixture shell term.' }],
        onboardingContext: {
          primary_role_summary: 'Claude shell onboarding fixture.',
          work_types: ['API development'],
          domain_language: ['ClaudeShell'],
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
    await withTempGlobalHome('shift-ax-shell-claude-onboarded-home-', async (home) => {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--claude-code', '--root', root, '--lang', 'en', '--onboarding-input', onboardingPath],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax claude shell exited ${code}`));
        });
      });

      const launchedCwd = await readFile(join(root, 'claude-launch.cwd'), 'utf8');
      const launchedArgs = await readFile(join(root, 'claude-launch.args'), 'utf8');
      const hook = await readFile(join(runtimeHome, '.claude', 'hooks', 'shift-ax-session-start.md'), 'utf8');
      const reviewCommand = await readFile(join(runtimeHome, '.claude', 'commands', 'review.md'), 'utf8');

      assert.ok(launchedCwd.trim().endsWith(root));
      assert.equal(launchedArgs.trim(), '');
      assert.match(hook, /\/onboard/);
      assert.match(hook, /Preferred user language: English/);
      assert.match(hook, /primary visible commands/);
      assert.match(reviewCommand, /shift-ax review --topic/);
      assert.equal(await pathExists(join(root, 'CLAUDE.md')), false);
      assert.equal(await pathExists(join(root, '.claude', 'commands', 'review.md')), false);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('shift-ax --full-auto enables runtime automation even when the saved default is disabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-shell-full-auto-flag-'));
  const runtimeHome = join(root, 'home');
  const binDir = join(root, 'bin');
  await mkdir(binDir, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeFakeLauncher(binDir, 'codex', join(root, 'codex-full-auto-launch'));

  try {
    await withTempGlobalHome('shift-ax-shell-full-auto-home-', async (home) => {
      await writeFile(
        join(home, 'settings.json'),
        JSON.stringify(
          {
            version: 1,
            updated_at: new Date().toISOString(),
            locale: 'en',
            preferred_language: 'english',
            preferred_platform: 'codex',
            default_full_auto: false,
          },
          null,
          2,
        ),
        'utf8',
      );

      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', '--codex', '--root', root, '--full-auto'],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              HOME: runtimeHome,
              SHIFT_AX_HOME: home,
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
          else reject(new Error(error || `shift-ax full-auto shell exited ${code}`));
        });
      });

      const settings = await readProjectSettings(root);
      const launchedArgs = await readFile(join(root, 'codex-full-auto-launch.args'), 'utf8');
      assert.equal(settings?.default_full_auto, false);
      assert.match(launchedArgs, /--yolo/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('package bin exposes only shift-ax for public shell entry', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_URL, 'utf8')) as {
    bin: Record<string, string>;
  };

  assert.deepEqual(packageJson.bin, { 'shift-ax': 'dist/scripts/ax.js' });
});

test('shift-ax version aliases print the package version', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_URL, 'utf8')) as {
    version: string;
  };

  for (const arg of ['--version', '-v', '-V', 'version']) {
    const stdout = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/ax.ts', arg], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(stdout.trim(), packageJson.version);
  }
});
