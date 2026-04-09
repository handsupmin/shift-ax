import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ShiftAxPlatform } from '../../adapters/contracts.js';

export type ShiftAxLocale = 'en' | 'ko';

export interface ShiftAxProjectSettings {
  version: 1;
  updated_at: string;
  locale: ShiftAxLocale;
  preferred_platform?: ShiftAxPlatform;
}

export function getProjectSettingsPath(rootDir: string): string {
  return join(rootDir, '.ax', 'project-settings.json');
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
  await mkdir(join(rootDir, '.ax'), { recursive: true });
  await writeFile(getProjectSettingsPath(rootDir), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}
