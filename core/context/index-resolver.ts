import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface IndexEntry {
  label: string;
  path: string;
}

export interface ResolvedContextMatch extends IndexEntry {
  absolute_path: string;
  score: number;
  content: string;
}

export interface ResolveContextInput {
  rootDir: string;
  indexPath: string;
  indexRootDir?: string;
  query: string;
  maxMatches?: number;
}

export interface ResolveContextResult {
  version: 1;
  index_path: string;
  query: string;
  matches: ResolvedContextMatch[];
  unresolved_paths: string[];
}

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function parseIndexDocument(markdown: string): IndexEntry[] {
  const lines = String(markdown || '').split(/\r?\n/);
  const entries: IndexEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const body = trimmed.slice(1).trim();
    const match = body.match(/^(.+?)\s*->\s*(.+)$/);
    if (!match) continue;

    entries.push({
      label: match[1]!.trim(),
      path: match[2]!.trim(),
    });
  }

  return entries;
}

function scoreEntry(entry: IndexEntry, queryTokens: string[]): number {
  const haystack = new Set([...tokenize(entry.label), ...tokenize(entry.path)]);

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.has(token)) score += 1;
  }
  return score;
}

export async function resolveContextFromIndex({
  rootDir,
  indexPath,
  indexRootDir,
  query,
  maxMatches = 5,
}: ResolveContextInput): Promise<ResolveContextResult> {
  if (!rootDir) throw new Error('rootDir is required');
  if (!indexPath) throw new Error('indexPath is required');
  if (!query || String(query).trim() === '') throw new Error('query is required');

  const rawIndex = await readFile(indexPath, 'utf8');
  const entries = parseIndexDocument(rawIndex);
  const queryTokens = tokenize(query);

  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxMatches);

  const matches: ResolvedContextMatch[] = [];
  const unresolvedPaths: string[] = [];
  const effectiveIndexRootDir = indexRootDir || rootDir;

  for (const item of scored) {
    const absolutePath = resolve(effectiveIndexRootDir, item.entry.path);
    try {
      const content = await readFile(absolutePath, 'utf8');
      matches.push({
        label: item.entry.label,
        path: item.entry.path,
        absolute_path: absolutePath,
        score: item.score,
        content,
      });
    } catch {
      unresolvedPaths.push(item.entry.path);
    }
  }

  return {
    version: 1,
    index_path: indexPath,
    query: String(query).trim(),
    matches,
    unresolved_paths: unresolvedPaths,
  };
}
