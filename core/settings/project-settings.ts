import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { ShiftAxPlatform } from '../../adapters/contracts.js';
import { getGlobalContextHome } from './global-context-home.js';

export type ShiftAxLocale = 'en' | 'ko';

export interface ShiftAxProjectSettings {
  version: 1;
  updated_at: string;
  locale: ShiftAxLocale;
  preferred_language?: 'english' | 'korean';
  preferred_platform?: ShiftAxPlatform;
}

export function getProjectSettingsPath(rootDir: string): string {
  return getGlobalContextHome().settingsPath;
}

export async function readProjectSettings(
  rootDir: string,
): Promise<ShiftAxProjectSettings | null> {
  try {
    const raw = JSON.parse(await readFile(getProjectSettingsPath(rootDir), 'utf8')) as Partial<ShiftAxProjectSettings> & {
      preferred_language?: 'english' | 'korean';
    };
    const locale =
      raw.locale ??
      (raw.preferred_language === 'korean'
        ? 'ko'
        : raw.preferred_language === 'english'
          ? 'en'
          : undefined);
    if (!locale) return null;
    return {
      version: 1,
      updated_at: raw.updated_at ?? new Date(0).toISOString(),
      locale,
      preferred_language: raw.preferred_language ?? (locale === 'ko' ? 'korean' : 'english'),
      ...(raw.preferred_platform ? { preferred_platform: raw.preferred_platform } : {}),
    };
  } catch {
    return null;
  }
}

export async function writeProjectSettings({
  rootDir,
  settings,
}: {
  rootDir: string;
  settings: ShiftAxProjectSettings;
}): Promise<void> {
  const path = getProjectSettingsPath(rootDir);
  await mkdir(getGlobalContextHome().root, { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        ...settings,
        preferred_language: settings.preferred_language ?? (settings.locale === 'ko' ? 'korean' : 'english'),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
