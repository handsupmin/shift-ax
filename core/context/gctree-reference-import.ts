import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxProjectContextDoc,
  type ShiftAxProjectProfile,
  writeProjectProfile,
} from '../policies/project-profile.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';

interface GctreeReferenceEntry {
  category: string;
  sourcePath: string;
  keywords: string[];
  title: string;
  summary: string;
}

export interface ImportGctreeReferenceInput {
  rootDir: string;
  referenceDir: string;
  overwrite?: boolean;
  engineeringDefaults?: ShiftAxEngineeringDefaults;
}

export interface ImportGctreeReferenceResult {
  documents: ShiftAxProjectContextDoc[];
  index: {
    indexPath: string;
    entries: ShiftAxProjectContextDoc[];
  };
  profile: ShiftAxProjectProfile;
  sharePath: string;
}

const CATEGORY_TO_SECTION: Record<string, string> = {
  Role: 'Role',
  Repos: 'Repositories',
  Repositories: 'Repositories',
  Workflows: 'Work Types',
  'Work Types': 'Work Types',
  Conventions: 'Procedures',
  Verification: 'Procedures',
  Infra: 'Procedures',
  Domain: 'Domain Language',
  'Domain Language': 'Domain Language',
};

const SECTION_ORDER = ['Role', 'Work Types', 'Repositories', 'Procedures', 'Domain Language'];

function slugify(value: string): string {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'context'
  );
}

function stripCategoryPrefix(value: string): string {
  return String(value || '')
    .replace(/^(role|repos|repositories|workflows|work types|conventions|verification|infra|domain|domain language)\s*:\s*/i, '')
    .trim();
}

function humanizePath(path: string): string {
  return stripCategoryPrefix(
    basename(path, '.md')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()),
  );
}

function parseTitle(markdown: string, fallbackPath: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return stripCategoryPrefix(heading || humanizePath(fallbackPath));
}

function parseSummary(markdown: string): string {
  const match = markdown.match(/## Summary\s+([\s\S]*?)(?:\n## |\n# |$)/);
  return match?.[1]?.trim().replace(/\s+/g, ' ') || '';
}

function parseReferenceIndex(indexMarkdown: string): Array<{ category: string; sourcePath: string; keywords: string[] }> {
  const entries: Array<{ category: string; sourcePath: string; keywords: string[] }> = [];
  let category = '';
  let current: { category: string; sourcePath: string; keywords: string[] } | null = null;

  for (const line of indexMarkdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      category = heading[1]!.trim();
      current = null;
      continue;
    }

    const doc = line.match(/^-\s+(docs\/.+\.md)\s*$/);
    if (doc && category) {
      current = {
        category,
        sourcePath: doc[1]!,
        keywords: [],
      };
      entries.push(current);
      continue;
    }

    const keyword = line.match(/^\s+-\s+(.+)$/);
    if (keyword && current) {
      current.keywords.push(stripCategoryPrefix(keyword[1]!.trim()));
    }
  }

  return entries;
}

function targetPathFor(entry: Pick<GctreeReferenceEntry, 'category' | 'sourcePath'>): string {
  const fileName = basename(entry.sourcePath);
  switch (entry.category) {
    case 'Role':
      return `role/${fileName}`;
    case 'Repos':
    case 'Repositories':
      return `repos/${fileName}`;
    case 'Workflows':
    case 'Work Types':
      return `work-types/${fileName}`;
    case 'Domain':
    case 'Domain Language':
      return `domain-language/${fileName}`;
    case 'Conventions':
      return `procedures/conventions--${fileName}`;
    case 'Verification':
      return `procedures/verification--${fileName}`;
    case 'Infra':
      return `procedures/infra--${fileName}`;
    default:
      return `procedures/${slugify(entry.category)}--${fileName}`;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function addUniqueEntry({
  entriesBySection,
  usedLabels,
  section,
  label,
  path,
}: {
  entriesBySection: Map<string, ShiftAxProjectContextDoc[]>;
  usedLabels: Set<string>;
  section: string;
  label: string;
  path: string;
}): void {
  const normalized = stripCategoryPrefix(label);
  if (!normalized || /\.md$/i.test(normalized)) return;
  const key = normalized.toLowerCase();
  if (usedLabels.has(key)) return;
  usedLabels.add(key);
  const current = entriesBySection.get(section) || [];
  current.push({ label: normalized, path });
  entriesBySection.set(section, current);
}

function renderShiftAxIndex(entriesBySection: Map<string, ShiftAxProjectContextDoc[]>): string {
  const lines = [
    '# Shift AX Global Index',
    '',
    'Notes:',
    '',
    '- This file is the single Shift AX dictionary.',
    '- Labels are search terms, aliases, repository names, workflow names, and domain terms.',
    '- Detailed procedures and repository notes live in linked markdown pages.',
    '- Reviewed topic artifacts override repository evidence, which override global knowledge, when they conflict.',
    '',
  ];

  for (const section of SECTION_ORDER) {
    lines.push(`## ${section}`, '');
    const entries = entriesBySection.get(section) || [];
    if (entries.length === 0) {
      lines.push('- None yet.');
    } else {
      for (const entry of entries) {
        lines.push(`- ${entry.label} -> ${entry.path}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function extractVerificationCommands(entries: GctreeReferenceEntry[]): string[] {
  const commands = new Set<string>();
  for (const entry of entries) {
    if (entry.category !== 'Verification') continue;
    const text = [...entry.keywords, entry.summary].join('\n');
    for (const command of ['pnpm type-check', 'pnpm lint', 'pnpm dto', 'pnpm test', 'npm run build', 'npm test']) {
      if (text.includes(command)) commands.add(command);
    }
  }
  return [...commands];
}

async function ensureOverwriteAllowed(paths: string[], overwrite: boolean): Promise<void> {
  const existing = [];
  for (const path of paths) {
    if (await pathExists(path)) existing.push(path);
  }
  if (!overwrite && existing.length > 0) {
    throw new Error(`global context file already exists and requires overwrite confirmation: ${existing[0]}`);
  }
}

export async function onboardProjectContextFromGctreeReference({
  rootDir,
  referenceDir,
  overwrite = false,
  engineeringDefaults = defaultEngineeringDefaults(),
}: ImportGctreeReferenceInput): Promise<ImportGctreeReferenceResult> {
  if (!rootDir) throw new Error('rootDir is required');
  if (!referenceDir) throw new Error('referenceDir is required');

  const home = getGlobalContextHome();
  const indexMarkdown = await readFile(join(referenceDir, 'index.md'), 'utf8');
  const parsed = parseReferenceIndex(indexMarkdown);
  if (parsed.length === 0) {
    throw new Error(`no gc-tree reference entries found in ${join(referenceDir, 'index.md')}`);
  }

  const entries: GctreeReferenceEntry[] = [];
  for (const item of parsed) {
    const sourceAbsolutePath = join(referenceDir, item.sourcePath);
    const markdown = await readFile(sourceAbsolutePath, 'utf8');
    entries.push({
      ...item,
      title: parseTitle(markdown, item.sourcePath),
      summary: parseSummary(markdown),
    });
  }

  const targetDocs = entries.map((entry) => ({
    entry,
    targetRelativePath: targetPathFor(entry),
    targetAbsolutePath: join(home.root, targetPathFor(entry)),
    sourceAbsolutePath: join(referenceDir, entry.sourcePath),
  }));
  const candidatePaths = [
    home.indexPath,
    home.profilePath,
    ...targetDocs.map((doc) => doc.targetAbsolutePath),
  ];
  await ensureOverwriteAllowed(candidatePaths, overwrite);

  for (const doc of targetDocs) {
    await mkdir(dirname(doc.targetAbsolutePath), { recursive: true });
    await cp(doc.sourceAbsolutePath, doc.targetAbsolutePath);
  }

  const entriesBySection = new Map<string, ShiftAxProjectContextDoc[]>();
  const usedLabels = new Set<string>();
  const documents: ShiftAxProjectContextDoc[] = [];
  const seenDocuments = new Set<string>();

  for (const doc of targetDocs) {
    const section = CATEGORY_TO_SECTION[doc.entry.category] || 'Procedures';
    if (!seenDocuments.has(doc.targetRelativePath)) {
      documents.push({ label: doc.entry.title, path: doc.targetRelativePath });
      seenDocuments.add(doc.targetRelativePath);
    }

    addUniqueEntry({
      entriesBySection,
      usedLabels,
      section,
      label: doc.entry.title,
      path: doc.targetRelativePath,
    });
    for (const keyword of doc.entry.keywords) {
      addUniqueEntry({
        entriesBySection,
        usedLabels,
        section,
        label: keyword,
        path: doc.targetRelativePath,
      });
    }
  }

  await mkdir(home.root, { recursive: true });
  await writeFile(home.indexPath, renderShiftAxIndex(entriesBySection), 'utf8');

  const importedVerificationCommands = extractVerificationCommands(entries);
  const roleSummary =
    entries.find((entry) => entry.category === 'Role')?.summary ||
    'Imported gc-tree reference knowledge.';
  const workTypes = documents
    .filter((doc) => doc.path.startsWith('work-types/'))
    .map((doc) => doc.label);
  const domainLanguage = documents
    .filter((doc) => doc.path.startsWith('domain-language/'))
    .map((doc) => doc.label);
  const profile: ShiftAxProjectProfile = {
    version: 1,
    updated_at: new Date().toISOString(),
    docs_root: home.root,
    index_path: 'index.md',
    context_docs: documents,
    onboarding_context: {
      primary_role_summary: roleSummary,
      work_types: workTypes,
      domain_language: domainLanguage,
    },
    engineering_defaults: {
      ...engineeringDefaults,
      verification_commands:
        importedVerificationCommands.length > 0
          ? importedVerificationCommands
          : engineeringDefaults.verification_commands,
    },
  };
  await writeProjectProfile(rootDir, profile);

  return {
    documents,
    index: {
      indexPath: home.indexPath,
      entries: documents,
    },
    profile,
    sharePath: home.root,
  };
}
