import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { access, mkdir, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { stdin, stdout } from 'node:process';

import { getPlatformBootstrapAssets } from '../../platform/index.js';
import { readProjectProfile } from '../policies/project-profile.js';
import {
  readProjectSettings,
  writeProjectSettings,
  type ShiftAxLocale,
  type ShiftAxProjectSettings,
} from '../settings/project-settings.js';
import type { ShiftAxPlatform } from '../../adapters/contracts.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';
import {
  fetchLatestShiftAxVersion,
  readInstalledShiftAxVersion,
  readUpdateCheckIntervalMs,
  runShiftAxUpdate,
  shouldFetchLatestShiftAxVersion,
  shouldPromptForShiftAxUpdate,
} from '../update/self-update.js';

const LEGACY_PRODUCT_SHELL_COMMANDS = [
  'onboard',
  'request',
  'export-context',
  'doctor',
  'status',
  'topics',
  'resume',
  'review',
];

const SHELL_COPY = {
  en: {
    chooseLanguage: 'Choose language:\n1. English (default)\n2. Korean\n> ',
    chooseFullAuto:
      'Enable full-auto mode by default?\n1. No (default)\n2. Yes\n> ',
    chooseUpdate: (current: string, latest: string) =>
      `A new Shift AX version is available. Current: ${current}, latest: ${latest}.\n1. Update now\n2. Skip this version\n> `,
    localeRule:
      'Preferred user language: English. Respond in English unless the user explicitly asks to switch.',
  },
  ko: {
    chooseLanguage: '언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
    chooseFullAuto:
      '기본으로 full-auto 모드를 켤까요?\n1. 아니오 (기본값)\n2. 예\n> ',
    chooseUpdate: (current: string, latest: string) =>
      `새 Shift AX 버전이 있습니다. 현재: ${current}, latest: ${latest}.\n1. 업데이트한다\n2. 이번 버전은 스킵한다\n> `,
    localeRule:
      '선호 사용자 언어: 한국어. 사용자가 명시적으로 바꾸라고 하지 않으면 한국어로 응답하세요.',
  },
} as const;

let nonTtyAnswerLinesPromise: Promise<string[]> | null = null;
let nonTtyAnswerIndex = 0;

async function readNonTtyAnswers(): Promise<string[]> {
  if (!nonTtyAnswerLinesPromise) {
    nonTtyAnswerLinesPromise = new Promise<string[]>((resolve, reject) => {
      let raw = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => {
        raw += chunk;
      });
      stdin.on('end', () => resolve(raw.split(/\r?\n/)));
      stdin.on('error', reject);
      stdin.resume();
    });
  }
  return nonTtyAnswerLinesPromise;
}

async function promptChoice({
  question,
  fallback,
}: {
  question: string;
  fallback: string;
}): Promise<string> {
  if (stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      return (await rl.question(question)).trim() || fallback;
    } finally {
      rl.close();
    }
  }

  const answers = await readNonTtyAnswers().catch(() => []);
  const answer = answers[nonTtyAnswerIndex] ?? '';
  nonTtyAnswerIndex += 1;
  return answer.trim() || fallback;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isProjectOnboarded(rootDir: string): Promise<boolean> {
  const home = getGlobalContextHome();
  return (await pathExists(home.indexPath)) && (await readProjectProfile(rootDir)) !== null;
}

export async function resolveShellLocale({
  rootDir,
  requestedLocale,
}: {
  rootDir: string;
  requestedLocale?: ShiftAxLocale;
}): Promise<ShiftAxLocale> {
  if (requestedLocale) return requestedLocale;
  const settings = await readProjectSettings(rootDir);
  if (settings?.locale) return settings.locale;

  const answer = await promptChoice({
    question: SHELL_COPY.en.chooseLanguage,
    fallback: '1',
  });
  return answer === '2' ? 'ko' : 'en';
}

export async function resolveShellPlatform({
  rootDir,
  requestedPlatform,
  locale,
}: {
  rootDir: string;
  requestedPlatform?: ShiftAxPlatform;
  locale: ShiftAxLocale;
}): Promise<ShiftAxPlatform> {
  if (requestedPlatform) return requestedPlatform;
  const settings = await readProjectSettings(rootDir);
  if (settings?.preferred_platform) return settings.preferred_platform;
  return 'codex';
}

export async function resolveShellDefaultFullAuto({
  rootDir,
  locale,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
}): Promise<boolean> {
  const settings = await readProjectSettings(rootDir);
  if (typeof settings?.default_full_auto === 'boolean') {
    return settings.default_full_auto;
  }

  const answer = await promptChoice({
    question: SHELL_COPY[locale].chooseFullAuto,
    fallback: '1',
  });
  return answer === '2';
}

export async function persistShellSettings({
  rootDir,
  locale,
  defaultFullAuto,
  platform,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
  defaultFullAuto?: boolean;
  platform: ShiftAxPlatform;
}): Promise<void> {
  const existing = (await readProjectSettings(rootDir)) as ShiftAxProjectSettings | null;
  await writeProjectSettings({
    rootDir,
    settings: {
      ...(existing ?? {}),
      version: 1,
      updated_at: new Date().toISOString(),
      locale,
      preferred_language: locale === 'ko' ? 'korean' : 'english',
      ...(typeof defaultFullAuto === 'boolean'
        ? { default_full_auto: defaultFullAuto }
        : typeof existing?.default_full_auto === 'boolean'
          ? { default_full_auto: existing.default_full_auto }
          : {}),
      preferred_platform: platform,
    },
  });
}

export async function maybePromptForShellUpdate({
  rootDir,
  locale,
  env = process.env,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
  env?: NodeJS.ProcessEnv;
}): Promise<'not_needed' | 'updated' | 'skipped' | 'unavailable'> {
  if (env.SHIFT_AX_SKIP_UPDATE_CHECK === '1') return 'not_needed';
  if (!stdin.isTTY && env.SHIFT_AX_FORCE_UPDATE_CHECK !== '1') return 'not_needed';

  const currentVersion = readInstalledShiftAxVersion(env);
  const settings = await readProjectSettings(rootDir);
  const checkedAt = new Date();
  if (
    env.SHIFT_AX_IGNORE_UPDATE_CACHE !== '1' &&
    !shouldFetchLatestShiftAxVersion({
      lastUpdateCheckAt: settings?.last_update_check_at,
      now: checkedAt,
      intervalMs: readUpdateCheckIntervalMs(env),
    })
  ) {
    return 'not_needed';
  }

  const latest = await fetchLatestShiftAxVersion({ env });
  if (latest.status !== 'ok' || !latest.latestVersion) {
    await writeProjectSettings({
      rootDir,
      settings: {
        ...(settings ?? {
          version: 1 as const,
          updated_at: checkedAt.toISOString(),
          locale,
          preferred_language: locale === 'ko' ? 'korean' : 'english',
        }),
        version: 1,
        updated_at: checkedAt.toISOString(),
        locale,
        preferred_language: settings?.preferred_language ?? (locale === 'ko' ? 'korean' : 'english'),
        last_update_check_at: checkedAt.toISOString(),
      },
    });
    return 'unavailable';
  }

  const cachedSettings: ShiftAxProjectSettings = {
    ...(settings ?? {
      version: 1 as const,
      updated_at: checkedAt.toISOString(),
      locale,
      preferred_language: locale === 'ko' ? 'korean' : 'english',
    }),
    version: 1,
    updated_at: checkedAt.toISOString(),
    locale,
    preferred_language: settings?.preferred_language ?? (locale === 'ko' ? 'korean' : 'english'),
    last_update_check_at: checkedAt.toISOString(),
    last_seen_latest_version: latest.latestVersion,
  };
  await writeProjectSettings({
    rootDir,
    settings: cachedSettings,
  });

  if (!shouldPromptForShiftAxUpdate({
    currentVersion,
    latestVersion: latest.latestVersion,
    skippedUpdateVersion: settings?.skipped_update_version,
  })) {
    return 'not_needed';
  }

  const answer = await promptChoice({
    question: SHELL_COPY[locale].chooseUpdate(currentVersion, latest.latestVersion),
    fallback: '2',
  });

  if (answer === '1') {
    await runShiftAxUpdate({
      rootDir,
      platform: 'both',
      locale,
      env,
    });
    return 'updated';
  }

  await writeProjectSettings({
    rootDir,
    settings: {
      ...cachedSettings,
      version: 1,
      updated_at: new Date().toISOString(),
      skipped_update_version: latest.latestVersion,
    },
  });
  return 'skipped';
}

export async function launchPlatformShell({
  rootDir,
  platform,
  fullAuto = false,
  initialPrompt,
}: {
  rootDir: string;
  platform: ShiftAxPlatform;
  fullAuto?: boolean;
  initialPrompt?: string;
}): Promise<number> {
  const locale = (await readProjectSettings(rootDir))?.locale ?? 'en';
  await refreshPlatformRuntimeAssets({ platform, rootDir, locale });

  const args =
    platform === 'codex'
      ? [...(fullAuto ? ['--yolo'] : []), '-C', rootDir, ...(initialPrompt?.trim() ? [initialPrompt.trim()] : [])]
      : [...(fullAuto ? ['--dangerously-skip-permissions'] : []), ...(initialPrompt?.trim() ? [initialPrompt.trim()] : [])];

  const child =
    platform === 'codex'
      ? spawn('codex', args, { stdio: 'inherit' })
      : spawn('claude', args, { cwd: rootDir, stdio: 'inherit' });

  return await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

export type ShiftAxRuntimeAssetPlatform = ShiftAxPlatform | 'both';

export async function refreshPlatformRuntimeAssets({
  platform,
  rootDir,
  locale,
}: {
  platform: ShiftAxRuntimeAssetPlatform;
  rootDir: string;
  locale: ShiftAxLocale;
}): Promise<void> {
  const platforms: ShiftAxPlatform[] = platform === 'both' ? ['codex', 'claude-code'] : [platform];
  for (const item of platforms) {
    await ensureSinglePlatformRuntimeAssets({ platform: item, rootDir, locale });
  }
}

async function ensureSinglePlatformRuntimeAssets({
  platform,
  rootDir,
  locale,
}: {
  platform: ShiftAxPlatform;
  rootDir: string;
  locale: ShiftAxLocale;
}): Promise<void> {
  const assets = getPlatformBootstrapAssets(platform, rootDir, locale);

  await Promise.all(
    assets.map(async (asset) => {
      const absolutePath = toGlobalRuntimeAssetPath({ platform, assetPath: asset.path });
      if (!absolutePath) return;
      const current = await readFile(absolutePath, 'utf8').catch(() => '');
      if (current.trim() && !isShiftAxGeneratedRuntimeAsset(current)) {
        return;
      }
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, asset.content, 'utf8');
    }),
  );

  await cleanupLegacyProjectRuntimeAssets({ platform, rootDir });
  await cleanupLegacyGlobalRuntimeAssets({ platform });
}

function toGlobalRuntimeAssetPath({
  platform,
  assetPath,
}: {
  platform: ShiftAxPlatform;
  assetPath: string;
}): string | null {
  const home = homedir();
  if (platform === 'codex') {
    if (assetPath.startsWith('.codex/')) return join(home, assetPath);
    return null;
  }

  if (assetPath.startsWith('.claude/')) return join(home, assetPath);
  return null;
}

function isShiftAxGeneratedRuntimeAsset(content: string): boolean {
  return /\bShift AX\b|shift-ax/.test(content);
}

async function cleanupLegacyProjectRuntimeAssets({
  platform,
  rootDir,
}: {
  platform: ShiftAxPlatform;
  rootDir: string;
}): Promise<void> {
  const paths = platform === 'codex'
    ? [
        '.codex/prompts/shift-ax-bootstrap.md',
        ...LEGACY_PRODUCT_SHELL_COMMANDS.map((name) => `.codex/skills/${name}/SKILL.md`),
      ]
    : [
        '.claude/hooks/shift-ax-session-start.md',
        ...LEGACY_PRODUCT_SHELL_COMMANDS.map((name) => `.claude/commands/${name}.md`),
      ];

  await Promise.all(
    projectRuntimeCleanupRoots(rootDir).flatMap((cleanupRoot) =>
      paths.map(async (path) => {
        await removeGeneratedRuntimeAsset({
          absolutePath: join(cleanupRoot, path),
          cleanupStopDir: cleanupRoot,
        });
      }),
    ),
  );
}

function projectRuntimeCleanupRoots(rootDir: string): string[] {
  const roots = [resolve(rootDir)];
  const home = resolve(homedir());
  if (!isPathInside(roots[0], home) || roots[0] === home) {
    return roots;
  }

  let current = dirname(roots[0]);
  while (current !== home && current !== dirname(current)) {
    roots.push(current);
    current = dirname(current);
  }
  return roots;
}

function isPathInside(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}${sep}`);
}

async function cleanupLegacyGlobalRuntimeAssets({
  platform,
}: {
  platform: ShiftAxPlatform;
}): Promise<void> {
  const home = homedir();
  const paths = platform === 'codex'
    ? ['.codex/skills/resume/SKILL.md']
    : ['.claude/commands/resume.md'];

  await Promise.all(
    paths.map(async (path) => {
      await removeGeneratedRuntimeAsset({
        absolutePath: join(home, path),
        cleanupStopDir: home,
      });
    }),
  );
}

async function removeGeneratedRuntimeAsset({
  absolutePath,
  cleanupStopDir,
}: {
  absolutePath: string;
  cleanupStopDir: string;
}): Promise<void> {
  const current = await readFile(absolutePath, 'utf8').catch(() => null);
  if (!current || !isShiftAxGeneratedRuntimeAsset(current)) return;

  await rm(absolutePath, { force: true });
  await removeEmptyParentDirs(dirname(absolutePath), cleanupStopDir);
}

async function removeEmptyParentDirs(dir: string, stopDir: string): Promise<void> {
  let current = dir;
  while (isPathInside(current, stopDir) && current !== stopDir) {
    const entries = await readdir(current).catch(() => null);
    if (!entries || entries.length > 0) return;
    await rmdir(current).catch(() => undefined);
    current = dirname(current);
  }
}
