import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
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

const SHELL_COPY = {
  en: {
    chooseLanguage: 'Choose language:\n1. English (default)\n2. Korean\n> ',
    localeRule:
      'Preferred user language: English. Respond in English unless the user explicitly asks to switch.',
  },
  ko: {
    chooseLanguage: '언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
    localeRule:
      '선호 사용자 언어: 한국어. 사용자가 명시적으로 바꾸라고 하지 않으면 한국어로 응답하세요.',
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

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(SHELL_COPY.en.chooseLanguage)).trim();
    return answer === '2' ? 'ko' : 'en';
  } catch {
    return 'en';
  } finally {
    rl.close();
  }
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
      preferred_language: locale === 'ko' ? 'korean' : 'english',
      preferred_platform: platform,
    },
  });
}

export async function launchPlatformShell({
  rootDir,
  platform,
  initialPrompt,
}: {
  rootDir: string;
  platform: ShiftAxPlatform;
  initialPrompt?: string;
}): Promise<number> {
  const locale = (await readProjectSettings(rootDir))?.locale ?? 'en';
  await ensurePlatformShellAssets({ platform, rootDir, locale });

  const args =
    platform === 'codex'
      ? ['-C', rootDir, ...(initialPrompt?.trim() ? [initialPrompt.trim()] : [])]
      : [...(initialPrompt?.trim() ? [initialPrompt.trim()] : [])];

  const child =
    platform === 'codex'
      ? spawn('codex', args, { stdio: 'inherit' })
      : spawn('claude', args, { cwd: rootDir, stdio: 'inherit' });

  return await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

async function ensurePlatformShellAssets({
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
