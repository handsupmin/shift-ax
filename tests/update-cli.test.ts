import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { readProjectSettings } from '../core/settings/project-settings.js';
import {
  shouldFetchLatestShiftAxVersion,
  shouldPromptForShiftAxUpdate,
} from '../core/update/self-update.js';
import { withTempGlobalHome } from './helpers/global-home.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function writeExecutable(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { mode: 0o755 });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runShiftAx({
  args,
  env,
  stdin = '',
}: {
  args: string[];
  env: NodeJS.ProcessEnv;
  stdin?: string;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/ax.ts', ...args], {
      cwd: REPO_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `shift-ax ${args.join(' ')} exited ${code}`));
    });
    child.stdin.end(stdin);
  });
}

test('update check prompts when npm latest differs and stores a skipped version globally', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shift-ax-update-prompt-'));
  const runtimeHome = join(sandbox, 'home');
  const root = join(runtimeHome, 'sources', 'app');
  const binDir = join(sandbox, 'bin');
  const npmLog = join(sandbox, 'npm-install.args');
  const codexLog = join(sandbox, 'codex.args');
  const fakeNpm = join(binDir, 'npm');
  const fakeCodex = join(binDir, 'codex');

  await mkdir(root, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeExecutable(
    fakeNpm,
    `#!/bin/sh
if [ "$1" = "view" ]; then
  printf '"9.9.9"\\n'
  exit 0
fi
printf '%s\\n' "$@" > ${JSON.stringify(npmLog)}
`,
  );
  await writeExecutable(
    fakeCodex,
    `#!/bin/sh
printf '%s\\n' "$@" > ${JSON.stringify(codexLog)}
`,
  );

  try {
    await withTempGlobalHome('shift-ax-update-prompt-home-', async (home) => {
      await runShiftAx({
        args: ['--codex', '--root', root, '--lang', 'ko'],
        stdin: '2\n2\n',
        env: {
          ...process.env,
          HOME: runtimeHome,
          SHIFT_AX_HOME: home,
          PATH: `${binDir}:${process.env.PATH}`,
          SHIFT_AX_FORCE_UPDATE_CHECK: '1',
          SHIFT_AX_CURRENT_VERSION_OVERRIDE: '0.5.4',
          SHIFT_AX_UPDATE_NPM_COMMAND: fakeNpm,
        },
      });

      const settings = await readProjectSettings(root);
      const codexArgs = await readFile(codexLog, 'utf8');

      assert.equal(settings?.skipped_update_version, '9.9.9');
      assert.equal(settings?.last_seen_latest_version, '9.9.9');
      assert.ok(settings?.last_update_check_at);
      assert.equal(settings?.default_full_auto, true);
      assert.match(codexArgs, /--yolo/);
      assert.equal(await pathExists(npmLog), false);
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('recent startup update cache avoids another npm latest lookup', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shift-ax-update-cache-'));
  const runtimeHome = join(sandbox, 'home');
  const root = join(runtimeHome, 'sources', 'app');
  const binDir = join(sandbox, 'bin');
  const npmLog = join(sandbox, 'npm-called.args');
  const codexLog = join(sandbox, 'codex.args');
  const fakeNpm = join(binDir, 'npm');
  const fakeCodex = join(binDir, 'codex');

  await mkdir(root, { recursive: true });
  await mkdir(runtimeHome, { recursive: true });
  await writeExecutable(
    fakeNpm,
    `#!/bin/sh
printf '%s\\n' "$@" > ${JSON.stringify(npmLog)}
exit 66
`,
  );
  await writeExecutable(
    fakeCodex,
    `#!/bin/sh
printf '%s\\n' "$@" > ${JSON.stringify(codexLog)}
`,
  );

  try {
    await withTempGlobalHome('shift-ax-update-cache-home-', async (home) => {
      const lastUpdateCheckAt = new Date().toISOString();
      await writeFile(
        join(home, 'settings.json'),
        `${JSON.stringify(
          {
            version: 1,
            updated_at: lastUpdateCheckAt,
            locale: 'ko',
            preferred_language: 'korean',
            last_update_check_at: lastUpdateCheckAt,
            last_seen_latest_version: '9.9.9',
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      await runShiftAx({
        args: ['--codex', '--root', root],
        stdin: '2\n',
        env: {
          ...process.env,
          HOME: runtimeHome,
          SHIFT_AX_HOME: home,
          PATH: `${binDir}:${process.env.PATH}`,
          SHIFT_AX_FORCE_UPDATE_CHECK: '1',
          SHIFT_AX_CURRENT_VERSION_OVERRIDE: '0.5.6',
          SHIFT_AX_UPDATE_NPM_COMMAND: fakeNpm,
        },
      });

      const settings = await readProjectSettings(root);
      const codexArgs = await readFile(codexLog, 'utf8');

      assert.equal(await pathExists(npmLog), false);
      assert.equal(settings?.last_update_check_at, lastUpdateCheckAt);
      assert.equal(settings?.last_seen_latest_version, '9.9.9');
      assert.match(codexArgs, /--yolo/);
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shift-ax update installs npm latest and re-runs global runtime scaffolding command', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shift-ax-update-cli-'));
  const root = join(sandbox, 'repo');
  const binDir = join(sandbox, 'bin');
  const npmLog = join(sandbox, 'npm.args');
  const shiftAxLog = join(sandbox, 'shift-ax.args');
  const fakeNpm = join(binDir, 'npm');
  const fakeShiftAx = join(binDir, 'shift-ax');

  await mkdir(root, { recursive: true });
  await writeExecutable(
    fakeNpm,
    `#!/bin/sh
printf '%s\\n' "$@" > ${JSON.stringify(npmLog)}
`,
  );
  await writeExecutable(
    fakeShiftAx,
    `#!/bin/sh
printf '%s\\n' "$@" > ${JSON.stringify(shiftAxLog)}
`,
  );

  try {
    await withTempGlobalHome('shift-ax-update-cli-home-', async (home) => {
      const { stdout } = await runShiftAx({
        args: ['update', '--root', root, '--platform', 'codex', '--lang', 'ko'],
        env: {
          ...process.env,
          HOME: join(sandbox, 'home'),
          SHIFT_AX_HOME: home,
          SHIFT_AX_UPDATE_NPM_COMMAND: fakeNpm,
          SHIFT_AX_UPDATE_SHIFT_AX_COMMAND: fakeShiftAx,
        },
      });

      const result = JSON.parse(stdout) as {
        installed: boolean;
        runtime_assets_refreshed: boolean;
        platform: string;
      };
      const npmArgs = (await readFile(npmLog, 'utf8')).trim().split('\n');
      const shiftAxArgs = (await readFile(shiftAxLog, 'utf8')).trim().split('\n');

      assert.equal(result.installed, true);
      assert.equal(result.runtime_assets_refreshed, true);
      assert.equal(result.platform, 'codex');
      assert.deepEqual(npmArgs, ['install', '-g', 'shift-ax@latest']);
      assert.deepEqual(shiftAxArgs, [
        'refresh-runtime',
        '--root',
        root,
        '--platform',
        'codex',
        '--lang',
        'ko',
      ]);
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('shift-ax refresh-runtime writes runtime commands only to the global platform home', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'shift-ax-refresh-runtime-'));
  const runtimeHome = join(sandbox, 'home');
  const root = join(runtimeHome, 'sources', 'app');

  await mkdir(join(root, '.codex', 'skills', 'request'), { recursive: true });
  await writeFile(join(root, '.codex', 'skills', 'request', 'SKILL.md'), 'Legacy Shift AX request skill', 'utf8');

  try {
    await withTempGlobalHome('shift-ax-refresh-runtime-home-', async (home) => {
      const { stdout } = await runShiftAx({
        args: ['refresh-runtime', '--root', root, '--platform', 'codex', '--lang', 'ko'],
        env: {
          ...process.env,
          HOME: runtimeHome,
          SHIFT_AX_HOME: home,
        },
      });

      const result = JSON.parse(stdout) as {
        status: string;
        runtime_assets_refreshed: boolean;
      };
      const requestSkill = await readFile(join(runtimeHome, '.codex', 'skills', 'request', 'SKILL.md'), 'utf8');

      assert.equal(result.status, 'ok');
      assert.equal(result.runtime_assets_refreshed, true);
      assert.match(requestSkill, /Start a new Shift AX request-to-commit flow/);
      assert.equal(await pathExists(join(root, '.codex', 'skills', 'request', 'SKILL.md')), false);
      assert.equal(await pathExists(join(runtimeHome, '.codex', 'skills', 'resume', 'SKILL.md')), false);
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('update prompt logic ignores current and explicitly skipped latest versions', () => {
  assert.equal(shouldPromptForShiftAxUpdate({
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
  }), false);
  assert.equal(shouldPromptForShiftAxUpdate({
    currentVersion: '1.0.0',
    latestVersion: '1.0.1',
    skippedUpdateVersion: '1.0.1',
  }), false);
  assert.equal(shouldPromptForShiftAxUpdate({
    currentVersion: '1.0.0',
    latestVersion: '1.0.1',
  }), true);
});

test('update check cache refreshes only after the interval expires', () => {
  const now = new Date('2026-05-18T12:00:00.000Z');

  assert.equal(shouldFetchLatestShiftAxVersion({
    lastUpdateCheckAt: new Date('2026-05-18T11:30:00.000Z').toISOString(),
    now,
    intervalMs: 60 * 60 * 1000,
  }), false);
  assert.equal(shouldFetchLatestShiftAxVersion({
    lastUpdateCheckAt: new Date('2026-05-18T10:30:00.000Z').toISOString(),
    now,
    intervalMs: 60 * 60 * 1000,
  }), true);
  assert.equal(shouldFetchLatestShiftAxVersion({
    lastUpdateCheckAt: 'not-a-date',
    now,
    intervalMs: 60 * 60 * 1000,
  }), true);
});
