import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { ShiftAxPlatform } from '../../adapters/contracts.js';
import { getGlobalContextHome } from './global-context-home.js';

export type ShiftAxLocale = 'en' | 'ko';

export interface ShiftAxProjectSettings {
  version: 1;
  updated_at: string;
  locale: ShiftAxLocale;
  preferred_platform?: ShiftAxPlatform;
}

export function getProjectSettingsPath(rootDir: string): string {
  return getGlobalContextHome().settingsPath;
}

export async function readProjectSettings(
  rootDir: string,
): Promise<ShiftAxProjectSettings | null> {
  try {
    return JSON.parse(await readFile(getProjectSettingsPath(rootDir), 'utf8')) as ShiftAxProjectSettings;
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
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}
