import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  authorBaseContextIndex,
  type AuthorBaseContextIndexResult,
} from './index-authoring.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
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
  engineeringDefaults?: ShiftAxEngineeringDefaults;
  now?: Date;
}

export interface OnboardProjectContextResult {
  documents: ShiftAxProjectContextDoc[];
  index: AuthorBaseContextIndexResult;
  profile: ShiftAxProjectProfile;
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

export async function onboardProjectContext({
  rootDir,
  documents,
  engineeringDefaults = defaultEngineeringDefaults(),
  now = new Date(),
}: OnboardProjectContextInput): Promise<OnboardProjectContextResult> {
  if (!rootDir) throw new Error('rootDir is required');
  if (!documents || documents.length === 0) {
    throw new Error('documents are required');
  }

  const resolvedDocs: ShiftAxProjectContextDoc[] = [];

  for (const document of documents) {
    const relativePath = resolveDocPath(document);
    const absolutePath = join(rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, document.content, 'utf8');
    resolvedDocs.push({ label: document.label, path: relativePath });
  }

  const index = await authorBaseContextIndex({
    rootDir,
    entries: resolvedDocs,
  });

  const profile: ShiftAxProjectProfile = {
    version: 1,
    updated_at: now.toISOString(),
    docs_root: 'docs/base-context',
    index_path: 'docs/base-context/index.md',
    context_docs: index.entries,
    engineering_defaults: engineeringDefaults,
  };

  await writeProjectProfile(rootDir, profile);

  return {
    documents: resolvedDocs,
    index,
    profile,
  };
}
