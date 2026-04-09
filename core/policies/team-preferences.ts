import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxTeamPreferences {
  implementation_style?: string;
  review_style?: string;
}

function path(rootDir: string): string {
  return join(rootDir, '.ax', 'team-preferences.json');
}

export async function readTeamPreferences(rootDir: string): Promise<ShiftAxTeamPreferences | null> {
  try {
    return JSON.parse(await readFile(path(rootDir), 'utf8')) as ShiftAxTeamPreferences;
  } catch {
    return null;
  }
}

export async function writeTeamPreferences({
  rootDir,
  preferences,
}: {
  rootDir: string;
  preferences: ShiftAxTeamPreferences;
}): Promise<void> {
  await mkdir(join(rootDir, '.ax'), { recursive: true });
  await writeFile(path(rootDir), `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
}
