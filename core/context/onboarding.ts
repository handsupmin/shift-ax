import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import {
  authorGlobalKnowledgeBase,
  type ShiftAxGlobalDomainLanguageInput,
  type ShiftAxGlobalWorkTypeInput,
} from './global-index-authoring.js';
import { discoverBaseContextEntries } from './discovery.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxOnboardingContextProfile,
  type ShiftAxProjectContextDoc,
  type ShiftAxProjectProfile,
  writeProjectProfile,
} from '../policies/project-profile.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';

export interface ShiftAxOnboardingDocumentInput {
  label: string;
  content: string;
  path?: string;
}

export interface ShiftAxGlobalOnboardingRepositoryInput {
  repository: string;
  repositoryPath?: string;
  purpose?: string;
  directories: string[];
  workflow: string;
  hiddenConventions?: string[];
  inferredNotes?: string[];
  confirmationNotes?: string;
  volatility?: 'stable' | 'volatile';
}

export interface ShiftAxGlobalOnboardingWorkTypeInput {
  name: string;
  summary?: string;
  repositories: ShiftAxGlobalOnboardingRepositoryInput[];
}

export interface OnboardProjectContextInput {
  rootDir: string;
  primaryRoleSummary?: string;
  workTypes?: ShiftAxGlobalOnboardingWorkTypeInput[];
  domainLanguage?: ShiftAxGlobalDomainLanguageInput[];
  onboardingContext?: ShiftAxOnboardingContextProfile;
  engineeringDefaults?: ShiftAxEngineeringDefaults;
  overwrite?: boolean;
  documents?: ShiftAxOnboardingDocumentInput[];
}

export interface OnboardProjectContextResult {
  documents: ShiftAxProjectContextDoc[];
  index: {
    indexPath: string;
    entries: ShiftAxProjectContextDoc[];
  };
  profile: ShiftAxProjectProfile;
  sharePath: string;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

function deriveLegacyWorkTypes({
  rootDir,
  documents,
}: {
  rootDir: string;
  documents: ShiftAxOnboardingDocumentInput[];
}): ShiftAxGlobalOnboardingWorkTypeInput[] {
  const repoName = basename(rootDir);

  return [
    {
      name: 'Repository Context',
      summary: 'Migrated legacy repository-local context.',
      repositories: [
        {
          repository: repoName,
          repositoryPath: rootDir,
          directories: documents.map((document) => document.path || `docs/base-context/${slugify(document.label)}.md`),
          workflow: documents
            .map((document) => `${document.label}: ${document.content.replace(/^# .*$/m, '').trim()}`)
            .join('\n\n'),
          volatility: 'volatile',
        },
      ],
    },
  ];
}

function deriveLegacyDomainLanguage(documents: ShiftAxOnboardingDocumentInput[]): ShiftAxGlobalDomainLanguageInput[] {
  return documents.map((document) => ({
    term: document.label,
    definition: `Migrated legacy context entry stored under ${document.path || `docs/base-context/${slugify(document.label)}.md`}.`,
  }));
}

async function backupFileIfPresent(path: string): Promise<void> {
  const home = getGlobalContextHome();
  if (!(await pathExists(path))) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir(home.backupsDir, { recursive: true });
  const backupName = `${stamp}-${basename(path)}`;
  await cp(path, join(home.backupsDir, backupName));
}

async function ensureOverwriteAllowed({
  overwrite,
  candidatePaths,
}: {
  overwrite: boolean;
  candidatePaths: string[];
}): Promise<void> {
  if (!overwrite) {
    for (const path of candidatePaths) {
      if (await pathExists(path)) {
        throw new Error(`global context file already exists and requires overwrite confirmation: ${path}`);
      }
    }
    return;
  }

  for (const path of candidatePaths) {
    await backupFileIfPresent(path);
  }
}

function normalizeOnboardingContext({
  primaryRoleSummary,
  workTypes,
  domainLanguage,
  onboardingContext,
}: {
  primaryRoleSummary: string;
  workTypes: ShiftAxGlobalWorkTypeInput[];
  domainLanguage: ShiftAxGlobalDomainLanguageInput[];
  onboardingContext?: ShiftAxOnboardingContextProfile;
}): ShiftAxOnboardingContextProfile {
  return (
    onboardingContext ?? {
      primary_role_summary: primaryRoleSummary,
      work_types: workTypes.map((workType) => workType.name),
      domain_language: domainLanguage.map((entry) => entry.term),
    }
  );
}

export async function persistProjectContextProfile({
  rootDir,
  entries,
  onboardingContext,
  engineeringDefaults,
  now,
}: {
  rootDir: string;
  entries: ShiftAxProjectContextDoc[];
  onboardingContext?: ShiftAxOnboardingContextProfile;
  engineeringDefaults: ShiftAxEngineeringDefaults;
  now: Date;
}): Promise<{
  index: {
    indexPath: string;
    entries: ShiftAxProjectContextDoc[];
  };
  profile: ShiftAxProjectProfile;
}> {
  const home = getGlobalContextHome();
  const profile: ShiftAxProjectProfile = {
    version: 1,
    updated_at: now.toISOString(),
    docs_root: home.root,
    index_path: relative(home.root, home.indexPath) || 'index.md',
    context_docs: entries,
    ...(onboardingContext ? { onboarding_context: onboardingContext } : {}),
    engineering_defaults: engineeringDefaults,
  };

  await writeProjectProfile(rootDir, profile);
  return {
    index: {
      indexPath: home.indexPath,
      entries,
    },
    profile,
  };
}

export async function onboardProjectContext({
  rootDir,
  primaryRoleSummary,
  workTypes,
  domainLanguage,
  onboardingContext,
  engineeringDefaults = defaultEngineeringDefaults(),
  overwrite = true,
  documents,
}: OnboardProjectContextInput): Promise<OnboardProjectContextResult> {
  if (!rootDir) throw new Error('rootDir is required');

  const derivedWorkTypes =
    workTypes && workTypes.length > 0
      ? workTypes
      : documents && documents.length > 0
        ? deriveLegacyWorkTypes({ rootDir, documents })
        : [];
  const derivedDomainLanguage =
    domainLanguage && domainLanguage.length > 0
      ? domainLanguage
      : documents && documents.length > 0
        ? deriveLegacyDomainLanguage(documents)
        : [];
  const derivedPrimaryRoleSummary =
    primaryRoleSummary?.trim() ||
    onboardingContext?.primary_role_summary?.trim() ||
    `Primary workflow owner for ${basename(rootDir)}.`;

  if (derivedWorkTypes.length === 0) {
    throw new Error('workTypes are required');
  }

  const home = getGlobalContextHome();
  const candidatePaths = [
    home.indexPath,
    home.profilePath,
    home.settingsPath,
    join(home.root, 'role', 'primary-role.md'),
    ...derivedWorkTypes.flatMap((workType) => [
      join(home.workTypesDir, `${slugify(workType.name)}.md`),
      ...workType.repositories.map((repository) =>
        join(home.reposDir, `${slugify(repository.repository || basename(repository.repositoryPath || 'repo'))}.md`),
      ),
      ...workType.repositories.map((repository) =>
        join(
          home.proceduresDir,
          `${slugify(workType.name)}--${slugify(repository.repository || basename(repository.repositoryPath || 'repo'))}.md`,
        ),
      ),
    ]),
    ...derivedDomainLanguage.map((entry) => join(home.domainLanguageDir, `${slugify(entry.term)}.md`)),
  ];

  await ensureOverwriteAllowed({
    overwrite,
    candidatePaths,
  });

  const index = await authorGlobalKnowledgeBase({
    primaryRoleSummary: derivedPrimaryRoleSummary,
    workTypes: derivedWorkTypes,
    domainLanguage: derivedDomainLanguage,
  });

  const { profile } = await persistProjectContextProfile({
    rootDir,
    entries: index.contextDocs,
    onboardingContext: normalizeOnboardingContext({
      primaryRoleSummary: derivedPrimaryRoleSummary,
      workTypes: derivedWorkTypes,
      domainLanguage: derivedDomainLanguage,
      onboardingContext,
    }),
    engineeringDefaults,
    now: new Date(),
  });

  return {
    documents: index.contextDocs,
    index: {
      indexPath: index.indexPath,
      entries: index.contextDocs,
    },
    profile,
    sharePath: home.root,
  };
}

export async function onboardProjectContextFromDiscovery({
  rootDir,
  onboardingContext,
  engineeringDefaults = defaultEngineeringDefaults(),
  includeGlossary = false,
  overwrite = true,
}: {
  rootDir: string;
  onboardingContext?: ShiftAxOnboardingContextProfile;
  engineeringDefaults?: ShiftAxEngineeringDefaults;
  includeGlossary?: boolean;
  overwrite?: boolean;
}): Promise<OnboardProjectContextResult> {
  const discovered = await discoverBaseContextEntries({ rootDir });
  if (discovered.length === 0) {
    throw new Error('no discoverable base-context documents were found');
  }

  const documents: ShiftAxOnboardingDocumentInput[] = await Promise.all(
    discovered.map(async (entry) => ({
      label: entry.label,
      path: entry.path,
      content: await readFile(join(rootDir, entry.path), 'utf8'),
    })),
  );

  const domainLanguage = includeGlossary
    ? discovered.map((entry) => ({
        term: entry.label,
        definition: `Migrated from ${entry.path}.`,
      }))
    : [];

  return onboardProjectContext({
    rootDir,
    documents,
    domainLanguage,
    onboardingContext,
    engineeringDefaults,
    overwrite,
  });
}
