import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ShiftAxGlobalContextHome {
  root: string;
  indexPath: string;
  workTypesDir: string;
  reposDir: string;
  proceduresDir: string;
  domainLanguageDir: string;
  backupsDir: string;
  profilePath: string;
  settingsPath: string;
}

export function resolveGlobalContextRoot({
  env = process.env,
  homeDir = homedir(),
}: {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
} = {}): string {
  const override = env.SHIFT_AX_HOME?.trim();
  if (override) return override;
  return join(homeDir, '.shift-ax');
}

export function getGlobalContextHome(options: {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
} = {}): ShiftAxGlobalContextHome {
  const root = resolveGlobalContextRoot(options);
  return {
    root,
    indexPath: join(root, 'index.md'),
    workTypesDir: join(root, 'work-types'),
    reposDir: join(root, 'repos'),
    proceduresDir: join(root, 'procedures'),
    domainLanguageDir: join(root, 'domain-language'),
    backupsDir: join(root, 'backups'),
    profilePath: join(root, 'profile.json'),
    settingsPath: join(root, 'settings.json'),
  };
}

export function toGlobalRelativePath(absolutePath: string, home = getGlobalContextHome()): string {
  if (!absolutePath.startsWith(home.root)) {
    return absolutePath;
  }
  return absolutePath.slice(home.root.length + 1);
}
