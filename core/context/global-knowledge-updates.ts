import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { parseIndexDocument, type IndexEntry } from './index-resolver.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';

export interface ShiftAxGlobalKnowledgeUpdate {
  kind: 'work-type' | 'domain-language';
  label: string;
  content: string;
  source: string;
}

const ELIGIBLE_GLOBAL_UPDATE_KINDS = new Set<ShiftAxGlobalKnowledgeUpdate['kind']>([
  'work-type',
  'domain-language',
]);

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

function timestampPrefix(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

async function backupIfPresent(path: string): Promise<void> {
  const home = getGlobalContextHome();
  const current = await readFile(path, 'utf8').catch(() => '');
  if (!current) return;
  await mkdir(home.backupsDir, { recursive: true });
  await writeFile(join(home.backupsDir, `${timestampPrefix()}-${basename(path)}`), current, 'utf8');
}

async function upsertIndexEntry(entry: IndexEntry): Promise<void> {
  const home = getGlobalContextHome();
  const raw = await readFile(home.indexPath, 'utf8').catch(() => '# Shift AX Global Index\n\n## Work Types\n\n- None yet.\n\n## Domain Language\n\n- None yet.\n');
  const entries = parseIndexDocument(raw).filter((current) => current.label !== entry.label);
  entries.push(entry);
  const workTypeEntries = entries.filter((current) => current.path.startsWith('work-types/'));
  const domainEntries = entries.filter((current) => current.path.startsWith('domain-language/'));
  const rendered = [
    '# Shift AX Global Index',
    '',
    '## Work Types',
    '',
    ...(workTypeEntries.length > 0 ? workTypeEntries.map((item) => `- ${item.label} -> ${item.path}`) : ['- None yet.']),
    '',
    '## Domain Language',
    '',
    ...(domainEntries.length > 0 ? domainEntries.map((item) => `- ${item.label} -> ${item.path}`) : ['- None yet.']),
    '',
  ].join('\n');
  await backupIfPresent(home.indexPath);
  await mkdir(home.root, { recursive: true });
  await writeFile(home.indexPath, `${rendered.trimEnd()}\n`, 'utf8');
}

function parseGlobalKnowledgeUpdates(markdown: string, source: string): ShiftAxGlobalKnowledgeUpdate[] {
  const lines = String(markdown || '').split(/\r?\n/);
  const updates: ShiftAxGlobalKnowledgeUpdate[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Global Knowledge Updates$/i.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(trimmed)) {
      break;
    }
    if (!inSection || !trimmed.startsWith('-')) continue;
    const body = trimmed.slice(1).trim();
    if (/^none/i.test(body)) continue;
    const match = body.match(/^(work-type|domain-language):\s*(.+?)\s*->\s*(.+)$/i);
    if (!match) continue;
    updates.push({
      kind: match[1]!.toLowerCase() as ShiftAxGlobalKnowledgeUpdate['kind'],
      label: match[2]!.trim(),
      content: match[3]!.trim(),
      source,
    });
  }

  return updates;
}

export async function applyGlobalKnowledgeUpdatesFromArtifacts({
  brainstormContent,
  specContent,
  implementationPlanContent,
}: {
  brainstormContent?: string;
  specContent?: string;
  implementationPlanContent?: string;
}): Promise<ShiftAxGlobalKnowledgeUpdate[]> {
  const updates = [
    ...parseGlobalKnowledgeUpdates(brainstormContent ?? '', 'brainstorm.md'),
    ...parseGlobalKnowledgeUpdates(specContent ?? '', 'spec.md'),
    ...parseGlobalKnowledgeUpdates(implementationPlanContent ?? '', 'implementation-plan.md'),
  ];

  const unique = new Map<string, ShiftAxGlobalKnowledgeUpdate>();
  for (const update of updates) {
    unique.set(`${update.kind}:${update.label}`, update);
  }

  const home = getGlobalContextHome();
  const applied = [...unique.values()];

  for (const update of applied) {
    if (!ELIGIBLE_GLOBAL_UPDATE_KINDS.has(update.kind)) {
      continue;
    }
    const slug = slugify(update.label);
    const relativePath =
      update.kind === 'work-type' ? `work-types/${slug}.md` : `domain-language/${slug}.md`;
    const absolutePath =
      update.kind === 'work-type'
        ? join(home.workTypesDir, `${slug}.md`)
        : join(home.domainLanguageDir, `${slug}.md`);
    const markdown =
      update.kind === 'work-type'
        ? `# ${update.label}\n\n## Stable Guidance\n\n${update.content}\n\n## Source\n\n- ${update.source}\n`
        : `# ${update.label}\n\n${update.content}\n\n## Source\n\n- ${update.source}\n`;
    await backupIfPresent(absolutePath);
    await mkdir(update.kind === 'work-type' ? home.workTypesDir : home.domainLanguageDir, {
      recursive: true,
    });
    await writeFile(absolutePath, markdown, 'utf8');
    await upsertIndexEntry({
      label: update.label,
      path: relativePath,
    });
  }

  return applied;
}
