import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  authorBaseContextIndex,
  type AuthorBaseContextIndexResult,
} from './index-authoring.js';
import { discoverBaseContextEntries } from './discovery.js';
import {
  extractDomainGlossaryEntries,
  writeDomainGlossaryDocument,
} from './glossary.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxOnboardingContextProfile,
  type ShiftAxProjectContextDoc,
  type ShiftAxProjectProfile,
  writeProjectProfile,
} from '../policies/project-profile.js';

export interface ShiftAxOnboardingDocumentInput {
  label: string;
  content: string;
  path?: string;
}

export interface OnboardProjectContextInput {
  rootDir: string;
  documents: ShiftAxOnboardingDocumentInput[];
  onboardingContext?: ShiftAxOnboardingContextProfile;
  engineeringDefaults?: ShiftAxEngineeringDefaults;
  now?: Date;
}

export interface OnboardProjectContextResult {
  documents: ShiftAxProjectContextDoc[];
  index: AuthorBaseContextIndexResult;
  profile: ShiftAxProjectProfile;
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
  index: AuthorBaseContextIndexResult;
  profile: ShiftAxProjectProfile;
}> {
  const index = await authorBaseContextIndex({
    rootDir,
    entries,
  });

  const profile: ShiftAxProjectProfile = {
    version: 1,
    updated_at: now.toISOString(),
    docs_root: 'docs/base-context',
    index_path: 'docs/base-context/index.md',
    context_docs: index.entries,
    ...(onboardingContext ? { onboarding_context: onboardingContext } : {}),
    engineering_defaults: engineeringDefaults,
  };

  await writeProjectProfile(rootDir, profile);
  return { index, profile };
}

function slugifyLabel(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

function resolveDocPath(input: ShiftAxOnboardingDocumentInput): string {
  if (input.path && input.path.trim() !== '') {
    return input.path.trim();
  }

  return `docs/base-context/${slugifyLabel(input.label)}.md`;
}

export async function writeOnboardingDocuments({
  rootDir,
  documents,
}: {
  rootDir: string;
  documents: ShiftAxOnboardingDocumentInput[];
}): Promise<ShiftAxProjectContextDoc[]> {
  const resolvedDocs: ShiftAxProjectContextDoc[] = [];

  for (const document of documents) {
    const relativePath = resolveDocPath(document);
    const absolutePath = join(rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, document.content, 'utf8');
    resolvedDocs.push({ label: document.label, path: relativePath });
  }

  return resolvedDocs;
}

export async function onboardProjectContext({
  rootDir,
  documents,
  onboardingContext,
  engineeringDefaults = defaultEngineeringDefaults(),
  now = new Date(),
}: OnboardProjectContextInput): Promise<OnboardProjectContextResult> {
  if (!rootDir) throw new Error('rootDir is required');
  if (!documents || documents.length === 0) {
    throw new Error('documents are required');
  }

  const resolvedDocs = await writeOnboardingDocuments({
    rootDir,
    documents,
  });

  const { index, profile } = await persistProjectContextProfile({
    rootDir,
    entries: resolvedDocs,
    onboardingContext,
    engineeringDefaults,
    now,
  });

  return {
    documents: resolvedDocs,
    index,
    profile,
  };
}

export async function onboardProjectContextFromDiscovery({
  rootDir,
  onboardingContext,
  engineeringDefaults = defaultEngineeringDefaults(),
  includeGlossary = false,
  now = new Date(),
}: {
  rootDir: string;
  onboardingContext?: ShiftAxOnboardingContextProfile;
  engineeringDefaults?: ShiftAxEngineeringDefaults;
  includeGlossary?: boolean;
  now?: Date;
}): Promise<OnboardProjectContextResult> {
  const documents = await discoverBaseContextEntries({ rootDir });
  if (documents.length === 0) {
    throw new Error('no discoverable base-context documents were found');
  }

  const resolvedDocs: ShiftAxProjectContextDoc[] = documents.map((document) => ({
    label: document.label,
    path: document.path,
  }));

  if (includeGlossary) {
    const glossaryEntries = await extractDomainGlossaryEntries({
      rootDir,
      documentPaths: resolvedDocs.map((doc) => doc.path),
    });
    if (glossaryEntries.length > 0) {
      const glossary = await writeDomainGlossaryDocument({
        rootDir,
        entries: glossaryEntries,
      });
      resolvedDocs.push({
        label: 'Domain Glossary',
        path: glossary.path,
      });
    }
  }

  const { index, profile } = await persistProjectContextProfile({
    rootDir,
    entries: resolvedDocs,
    onboardingContext,
    engineeringDefaults,
    now,
  });

  return {
    documents: resolvedDocs,
    index,
    profile,
  };
}
