import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ShiftAxLearnedDebugNote {
  id: string;
  summary: string;
  resolution: string;
  occurrences: number;
  approved: boolean;
  fix_commit?: string;
  created_at: string;
}

function storePath(rootDir: string): string {
  return join(rootDir, '.ax', 'memory', 'learned-debug.json');
}

async function readStore(rootDir: string): Promise<ShiftAxLearnedDebugNote[]> {
  try {
    return JSON.parse(await readFile(storePath(rootDir), 'utf8')) as ShiftAxLearnedDebugNote[];
  } catch {
    return [];
  }
}

async function writeStore(rootDir: string, notes: ShiftAxLearnedDebugNote[]): Promise<void> {
  const path = storePath(rootDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
}

function matchesQuery(note: ShiftAxLearnedDebugNote, query?: string): boolean {
  if (!query) return true;
  const haystack = `${note.summary}\n${note.resolution}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .every((token) => haystack.includes(token));
}

export async function recordLearnedDebugNote({
  rootDir,
  summary,
  resolution,
  occurrences = 1,
  approved = false,
  fixCommit,
  now = new Date(),
}: {
  rootDir: string;
  summary: string;
  resolution: string;
  occurrences?: number;
  approved?: boolean;
  fixCommit?: string;
  now?: Date;
}): Promise<ShiftAxLearnedDebugNote> {
  if (occurrences < 2 && !approved && !fixCommit) {
    throw new Error('learned-debug notes require approval, repeated occurrences, or a fix commit');
  }

  const notes = await readStore(rootDir);
  const note: ShiftAxLearnedDebugNote = {
    id: randomUUID(),
    summary,
    resolution,
    occurrences,
    approved,
    ...(fixCommit ? { fix_commit: fixCommit } : {}),
    created_at: now.toISOString(),
  };
  notes.push(note);
  await writeStore(rootDir, notes);
  return note;
}

export async function listLearnedDebugNotes({
  rootDir,
  query,
}: {
  rootDir: string;
  query?: string;
}): Promise<ShiftAxLearnedDebugNote[]> {
  const notes = await readStore(rootDir);
  return notes.filter((note) => matchesQuery(note, query));
}
