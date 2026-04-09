import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ShiftAxThreadSummary {
  name: string;
  path: string;
  updated_at: string;
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'thread';
}

function threadPath(rootDir: string, name: string): string {
  return join(rootDir, '.ax', 'threads', `${slugify(name)}.md`);
}

export async function saveThreadNote({
  rootDir,
  name,
  summary,
  note,
  now = new Date(),
}: {
  rootDir: string;
  name: string;
  summary?: string;
  note: string;
  now?: Date;
}): Promise<{ path: string }> {
  const path = threadPath(rootDir, name);
  const existing = await readFile(path, 'utf8').catch(() => '');
  const lines =
    existing.trim().length > 0
      ? existing
          .replace(/- updated_at:\s*.+$/m, `- updated_at: ${now.toISOString()}`)
          .trimEnd()
          .concat(`\n\n- ${now.toISOString()}: ${note.trim()}`)
      : [
          `# Thread: ${name}`,
          '',
          `- updated_at: ${now.toISOString()}`,
          '',
          '## Summary',
          '',
          (summary || `Thread for ${name}`).trim(),
          '',
          '## Notes',
          '',
          `- ${now.toISOString()}: ${note.trim()}`,
        ].join('\n');

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${lines}\n`, 'utf8');
  return { path };
}

export async function listThreads({
  rootDir,
}: {
  rootDir: string;
}): Promise<ShiftAxThreadSummary[]> {
  const dir = join(rootDir, '.ax', 'threads');
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const result: ShiftAxThreadSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const path = join(dir, entry.name);
    const content = await readFile(path, 'utf8').catch(() => '');
    const updatedAt =
      content.match(/- updated_at:\s*(.+)\s*$/m)?.[1]?.trim() ||
      content.match(/- (\d{4}-\d{2}-\d{2}T[^:]+:[^\n]+)/)?.[1]?.trim() ||
      '';
    result.push({
      name: entry.name.replace(/\.md$/, ''),
      path,
      updated_at: updatedAt,
    });
  }

  return result.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}
