import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

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

const SHELL_COPY = {
  en: {
    welcomeCodex:
      'Start Shift AX shell mode for this repository. Be conversational. Treat `/onboarding`, `/request <text>`, `/export-context`, `/doctor`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` and the same `$...` aliases as Shift AX product-shell commands. Keep global-index-first behavior, and if the user speaks naturally, map that intent to the right Shift AX flow without forcing raw CLI syntax.',
    welcomeClaude:
      'Start Shift AX shell mode for this repository. Be conversational. Treat `/onboarding`, `/request <text>`, `/export-context`, `/doctor`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` and the same `$...` aliases as Shift AX product-shell commands. Keep global-index-first behavior, and if the user speaks naturally, map that intent to the right Shift AX flow without forcing raw CLI syntax.',
    firstRunHint:
      'No global Shift AX profile was found yet. Start naturally, but strongly recommend `/onboarding` before `/request` so planning can use ~/.shift-ax/index.md.',
  },
  ko: {
    welcomeCodex:
      '이 저장소에서 Shift AX 셸 모드로 시작하세요. 대화형으로 동작하세요. `/onboarding`, `/request <요청>`, `/export-context`, `/doctor`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` 와 같은 slash 명령과 동일한 `$...` 명령을 Shift AX 제품 셸 명령으로 해석하세요. global-index-first 원칙을 지키고, 사용자가 자연어로 말하면 원시 CLI 문법을 강요하지 말고 적절한 Shift AX 흐름으로 연결하세요.',
    welcomeClaude:
      '이 저장소에서 Shift AX 셸 모드로 시작하세요. 대화형으로 동작하세요. `/onboarding`, `/request <요청>`, `/export-context`, `/doctor`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` 와 같은 slash 명령과 동일한 `$...` 명령을 Shift AX 제품 셸 명령으로 해석하세요. global-index-first 원칙을 지키고, 사용자가 자연어로 말하면 원시 CLI 문법을 강요하지 말고 적절한 Shift AX 흐름으로 연결하세요.',
    firstRunHint:
      '아직 글로벌 Shift AX 프로필이 없습니다. 바로 대화를 시작하되, `/request` 전에 `/onboarding` 을 먼저 하라고 강하게 안내하세요. 그래야 ~/.shift-ax/index.md 를 기반으로 정확하게 계획할 수 있습니다.',
  },
} as const;

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
  return 'en';
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

export async function persistShellSettings({
  rootDir,
  locale,
  platform,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
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
      preferred_platform: platform,
    },
  });
}

export async function launchPlatformShell({
  rootDir,
  platform,
  locale,
  initialPrompt,
}: {
  rootDir: string;
  platform: ShiftAxPlatform;
  locale?: ShiftAxLocale;
  initialPrompt?: string;
}): Promise<number> {
  await ensurePlatformShellAssets({ platform, rootDir });

  const onboarded = await isProjectOnboarded(rootDir);
  const promptBase = buildShellPrompt({
    platform,
    locale: locale ?? 'en',
    onboarded,
  });
  const prompt = [promptBase, initialPrompt?.trim()].filter(Boolean).join('\n\n');

  const child =
    platform === 'codex'
      ? spawn('codex', ['-C', rootDir, prompt], { stdio: 'inherit' })
      : spawn('claude', [prompt], { cwd: rootDir, stdio: 'inherit' });

  return await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

function buildShellPrompt({
  platform,
  locale,
  onboarded,
}: {
  platform: ShiftAxPlatform;
  locale: ShiftAxLocale;
  onboarded: boolean;
}): string {
  const copy = SHELL_COPY[locale];
  const welcome = platform === 'codex' ? copy.welcomeCodex : copy.welcomeClaude;
  return onboarded ? welcome : `${welcome}\n\n${copy.firstRunHint}`;
}

async function ensurePlatformShellAssets({
  platform,
  rootDir,
}: {
  platform: ShiftAxPlatform;
  rootDir: string;
}): Promise<void> {
  const assets = getPlatformBootstrapAssets(platform, rootDir);

  await Promise.all(
    assets.map(async (asset) => {
      const absolutePath = join(rootDir, asset.path);
      const current = await readFile(absolutePath, 'utf8').catch(() => '');
      const isTopLevelBootstrap = asset.path === 'AGENTS.md' || asset.path === 'CLAUDE.md';
      if (isTopLevelBootstrap && current.trim() && !current.includes('Shift AX')) {
        return;
      }
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, asset.content, 'utf8');
    }),
  );
}
