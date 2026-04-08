import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxEngineeringDefaults {
  test_strategy: string;
  architecture: string;
  short_task_execution: string;
  long_task_execution: string;
  verification_commands?: string[];
}

export interface ShiftAxProjectContextDoc {
  label: string;
  path: string;
}

export interface ShiftAxOnboardingContextProfile {
  business_context: string;
  policy_areas: string[];
  architecture_summary: string;
  risky_domains: string[];
}

export interface ShiftAxProjectProfile {
  version: 1;
  updated_at: string;
  docs_root: string;
  index_path: string;
  context_docs: ShiftAxProjectContextDoc[];
  onboarding_context?: ShiftAxOnboardingContextProfile;
  engineering_defaults: ShiftAxEngineeringDefaults;
}

export function defaultEngineeringDefaults(): ShiftAxEngineeringDefaults {
  return {
    test_strategy: 'tdd',
    architecture: 'clean-boundaries',
    short_task_execution: 'subagent',
    long_task_execution: 'tmux',
    verification_commands: ['npm test', 'npm run build'],
  };
}

export function getProjectProfilePath(rootDir: string): string {
  return join(rootDir, '.ax', 'project-profile.json');
}

export async function readProjectProfile(
  rootDir: string,
): Promise<ShiftAxProjectProfile | null> {
  try {
    const raw = await readFile(getProjectProfilePath(rootDir), 'utf8');
    return JSON.parse(raw) as ShiftAxProjectProfile;
  } catch {
    return null;
  }
}

export async function writeProjectProfile(
  rootDir: string,
  profile: ShiftAxProjectProfile,
): Promise<void> {
  const path = getProjectProfilePath(rootDir);
  await mkdir(join(rootDir, '.ax'), { recursive: true });
  await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
}
