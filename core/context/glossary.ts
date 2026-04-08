import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ShiftAxGlossaryEntry {
  term: string;
  definition: string;
  sources: string[];
}

export interface ExtractDomainGlossaryEntriesInput {
  rootDir: string;
  documentPaths: string[];
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function scoreTerm(term: string): number {
  const noSpaces = term.replace(/\s+/g, '');
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(noSpaces)) return 3; // CamelCase
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(term)) return 2; // Title case phrase
  if (/^[A-Z][a-z]+(?:[A-Z][A-Za-z0-9]+)+$/.test(term)) return 3;
  return 1;
}

function extractCandidateTerms(content: string): string[] {
  const candidates = new Set<string>();
  const headingMatches = content.match(/^#\s+(.+)$/gm) ?? [];
  for (const match of headingMatches) {
    candidates.add(match.replace(/^#\s+/, '').trim());
  }

  const camelMatches = content.match(/\b[A-Z][a-z]+(?:[A-Z][A-Za-z0-9]+)+\b/g) ?? [];
  for (const term of camelMatches) {
    candidates.add(term.trim());
  }

  const titlePhraseMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) ?? [];
  for (const term of titlePhraseMatches) {
    candidates.add(term.trim());
  }

  return [...candidates]
    .filter((term) => term.length >= 4)
    .filter((term) => !['Base Context Index', 'Domain Glossary'].includes(term))
    .sort((a, b) => scoreTerm(b) - scoreTerm(a) || a.localeCompare(b));
}

function buildDefinition(term: string, sourcePath: string): string {
  return `Detected from ${sourcePath} as a likely domain or architecture term.`;
}

export async function extractDomainGlossaryEntries({
  rootDir,
  documentPaths,
}: ExtractDomainGlossaryEntriesInput): Promise<ShiftAxGlossaryEntry[]> {
  const byTerm = new Map<string, ShiftAxGlossaryEntry>();

  for (const path of documentPaths) {
    const content = await readFile(join(rootDir, path), 'utf8').catch(() => '');
    if (!content.trim()) continue;

    for (const term of extractCandidateTerms(content)) {
      const existing = byTerm.get(term);
      if (existing) {
        existing.sources = uniq([...existing.sources, path]);
        continue;
      }

      byTerm.set(term, {
        term,
        definition: buildDefinition(term, path),
        sources: [path],
      });
    }
  }

  return [...byTerm.values()].sort((a, b) => a.term.localeCompare(b.term));
}

export async function writeDomainGlossaryDocument({
  rootDir,
  entries,
  path = 'docs/base-context/domain-glossary.md',
}: {
  rootDir: string;
  entries: ShiftAxGlossaryEntry[];
  path?: string;
}): Promise<{ path: string }> {
  const absolutePath = join(rootDir, path);
  await mkdir(dirname(absolutePath), { recursive: true });

  const lines = ['# Domain Glossary', ''];
  for (const entry of entries) {
    lines.push(`## ${entry.term}`);
    lines.push('');
    lines.push(entry.definition);
    lines.push('');
    lines.push(`Sources: ${entry.sources.join(', ')}`);
    lines.push('');
  }

  await writeFile(absolutePath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
  return { path };
}
