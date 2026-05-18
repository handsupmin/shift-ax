import { spawn, execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { ShiftAxLocale } from '../settings/project-settings.js';
import type { ShiftAxRuntimeAssetPlatform } from '../shell/platform-shell.js';

const execFileAsync = promisify(execFile);

export interface ShiftAxLatestVersionResult {
  status: 'ok' | 'unavailable';
  latestVersion?: string;
  error?: string;
}

export interface ShiftAxUpdateCheckInput {
  currentVersion: string;
  latestVersion?: string;
  skippedUpdateVersion?: string;
}

export interface ShiftAxUpdateRunResult {
  package: 'shift-ax';
  target: 'latest';
  installed: boolean;
  runtime_assets_refreshed: boolean;
  platform: ShiftAxRuntimeAssetPlatform;
}

export function readInstalledShiftAxVersion(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.SHIFT_AX_CURRENT_VERSION_OVERRIDE?.trim();
  if (override) return override;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', '..', '..', 'package.json'),
    join(here, '..', '..', 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: string };
      if (parsed.version) return parsed.version;
    } catch {
      // Try the next package.json candidate.
    }
  }
  return 'unknown';
}

export function normalizeNpmVersion(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : null;
  } catch {
    return trimmed.replace(/^"|"$/g, '').trim() || null;
  }
}

export async function fetchLatestShiftAxVersion({
  npmCommand,
  env = process.env,
  timeoutMs = 3000,
}: {
  npmCommand?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
} = {}): Promise<ShiftAxLatestVersionResult> {
  const resolvedNpmCommand = npmCommand || env.SHIFT_AX_UPDATE_NPM_COMMAND || 'npm';
  try {
    const { stdout } = await execFileAsync(
      resolvedNpmCommand,
      ['view', 'shift-ax', 'version', '--json', '--prefer-online'],
      {
        env,
        timeout: timeoutMs,
        encoding: 'utf8',
      },
    );
    const latestVersion = normalizeNpmVersion(stdout);
    return latestVersion
      ? { status: 'ok', latestVersion }
      : { status: 'unavailable', error: 'npm returned an empty version' };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function shouldPromptForShiftAxUpdate({
  currentVersion,
  latestVersion,
  skippedUpdateVersion,
}: ShiftAxUpdateCheckInput): boolean {
  return Boolean(
    currentVersion &&
    currentVersion !== 'unknown' &&
    latestVersion &&
    latestVersion !== currentVersion &&
    latestVersion !== skippedUpdateVersion,
  );
}

export async function runShiftAxUpdate({
  rootDir,
  platform = 'both',
  locale = 'en',
  npmCommand,
  shiftAxCommand,
  env = process.env,
  install = true,
  refreshRuntimeAssets = true,
  stdio = 'inherit',
}: {
  rootDir: string;
  platform?: ShiftAxRuntimeAssetPlatform;
  locale?: ShiftAxLocale;
  npmCommand?: string;
  shiftAxCommand?: string;
  env?: NodeJS.ProcessEnv;
  install?: boolean;
  refreshRuntimeAssets?: boolean;
  stdio?: 'inherit' | 'ignore';
}): Promise<ShiftAxUpdateRunResult> {
  const resolvedNpmCommand = npmCommand || env.SHIFT_AX_UPDATE_NPM_COMMAND || 'npm';
  const resolvedShiftAxCommand = shiftAxCommand || env.SHIFT_AX_UPDATE_SHIFT_AX_COMMAND || 'shift-ax';

  if (install) {
    await runCommand(resolvedNpmCommand, ['install', '-g', 'shift-ax@latest'], { env, stdio });
  }

  if (refreshRuntimeAssets) {
    await runCommand(
      resolvedShiftAxCommand,
      [
        'refresh-runtime',
        '--root',
        rootDir,
        '--platform',
        platform,
        '--lang',
        locale,
      ],
      {
        env: {
          ...env,
          SHIFT_AX_SKIP_UPDATE_CHECK: '1',
        },
        stdio,
      },
    );
  }

  return {
    package: 'shift-ax',
    target: 'latest',
    installed: install,
    runtime_assets_refreshed: refreshRuntimeAssets,
    platform,
  };
}

function runCommand(
  command: string,
  args: string[],
  {
    env,
    stdio,
  }: {
    env: NodeJS.ProcessEnv;
    stdio: 'inherit' | 'ignore';
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited ${code ?? 1}`));
      }
    });
  });
}

export function normalizeRuntimeAssetPlatform(
  value: string | undefined,
  fallback: ShiftAxRuntimeAssetPlatform = 'both',
): ShiftAxRuntimeAssetPlatform | null {
  if (!value) return fallback;
  if (value === 'codex' || value === 'claude-code' || value === 'both') return value;
  return null;
}

export function normalizeUpdateLocale(
  value: string | undefined,
  fallback: ShiftAxLocale = 'en',
): ShiftAxLocale | null {
  if (!value) return fallback;
  if (value === 'en' || value === 'ko') return value;
  return null;
}
