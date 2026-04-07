import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  parseIndexDocument,
  type IndexEntry,
} from './index-resolver.js';

export interface AuthorBaseContextIndexInput {
  rootDir: string;
  indexPath?: string;
  entries: IndexEntry[];
}

export interface AuthorBaseContextIndexResult {
  indexPath: string;
  entries: IndexEntry[];
}

function dedupeEntries(entries: IndexEntry[]): IndexEntry[] {
  const seen = new Set<string>();
  const result: IndexEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.label}::${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

export function renderIndexDocument(entries: IndexEntry[]): string {
  const lines = ['# Base Context Index', ''];

  for (const entry of entries) {
    lines.push(`- ${entry.label} -> ${entry.path}`);
  }

  lines.push('');
  lines.push('Notes:');
  lines.push('');
  lines.push('- each line should point to a concrete tracked document');
  lines.push('- documents in this directory are shared and versioned');
  lines.push('- request-local planning or review artifacts should not live here');
  lines.push('');

  return lines.join('\n');
}

export async function authorBaseContextIndex({
  rootDir,
  indexPath = join(rootDir, 'docs', 'base-context', 'index.md'),
  entries,
}: AuthorBaseContextIndexInput): Promise<AuthorBaseContextIndexResult> {
  if (!rootDir) throw new Error('rootDir is required');

  let existing: IndexEntry[] = [];
  try {
    existing = parseIndexDocument(await readFile(indexPath, 'utf8'));
  } catch {
    existing = [];
  }

  const merged = dedupeEntries([...existing, ...entries]);
  await mkdir(join(rootDir, 'docs', 'base-context'), { recursive: true });
  await writeFile(indexPath, renderIndexDocument(merged), 'utf8');

  return {
    indexPath,
    entries: merged,
  };
}
