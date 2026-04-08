import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface ShiftAxDiscoveredContextEntry {
  label: string;
  path: string;
  reason: string;
}

export interface DiscoverBaseContextEntriesInput {
  rootDir: string;
}

const EXCLUDED_SEGMENTS = new Set(['base-context', 'verification', 'roadmap', '.ax']);
const INCLUDED_KEYWORDS = [
  'architecture',
  'policy',
  'policies',
  'domain',
  'glossary',
  'context',
  'overview',
  'service',
  'reference',
  'decision',
  'adr',
];

async function walkMarkdownFiles(dir: string, rootDir: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if ([...EXCLUDED_SEGMENTS].some((segment) => relPath.split('/').includes(segment))) {
        continue;
      }
      await walkMarkdownFiles(fullPath, rootDir, results);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.md')) continue;
    if (entry.name.toLowerCase() === 'index.md' && relPath.includes('docs/base-context')) continue;
    results.push(relPath);
  }
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

async function readHeading(rootDir: string, relPath: string): Promise<string | null> {
  try {
    const content = await readFile(join(rootDir, relPath), 'utf8');
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1]!.trim() : null;
  } catch {
    return null;
  }
}

function looksRelevant(path: string): boolean {
  const normalized = path.toLowerCase();
  return INCLUDED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export async function discoverBaseContextEntries({
  rootDir,
}: DiscoverBaseContextEntriesInput): Promise<ShiftAxDiscoveredContextEntry[]> {
  const docsRoot = join(rootDir, 'docs');
  const files: string[] = [];
  await walkMarkdownFiles(docsRoot, rootDir, files).catch(() => undefined);

  const relevantFiles = files.filter(looksRelevant);
  const discovered: ShiftAxDiscoveredContextEntry[] = [];

  for (const relPath of relevantFiles) {
    const label =
      (await readHeading(rootDir, relPath)) ??
      humanizeSlug(relPath.split('/').pop()?.replace(/\.md$/i, '') ?? relPath);
    const topLevel = relPath.split('/')[1] ?? 'docs';
    discovered.push({
      label,
      path: relPath,
      reason: `Detected from docs/${topLevel}/ markdown structure.`,
    });
  }

  const seen = new Set<string>();
  return discovered.filter((entry) => {
    const key = `${entry.label}::${entry.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
