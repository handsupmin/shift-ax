import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ShiftAxDecisionRecord {
  id: string;
  title: string;
  summary: string;
  category: string;
  valid_from: string;
  valid_to?: string;
  status: 'active' | 'superseded';
  replaced_by?: string;
  source_topic?: string;
  source_doc?: string;
  created_at: string;
}

function getDecisionRegisterPath(rootDir: string): string {
  return join(rootDir, '.ax', 'memory', 'decision-register.json');
}

async function readDecisionRegister(rootDir: string): Promise<ShiftAxDecisionRecord[]> {
  try {
    const raw = await readFile(getDecisionRegisterPath(rootDir), 'utf8');
    return JSON.parse(raw) as ShiftAxDecisionRecord[];
  } catch {
    return [];
  }
}

async function writeDecisionRegister(rootDir: string, records: ShiftAxDecisionRecord[]): Promise<void> {
  const path = getDecisionRegisterPath(rootDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

export async function recordDecision({
  rootDir,
  title,
  summary,
  category,
  validFrom,
  sourceTopic,
  sourceDoc,
  now = new Date(),
}: {
  rootDir: string;
  title: string;
  summary: string;
  category: string;
  validFrom: string;
  sourceTopic?: string;
  sourceDoc?: string;
  now?: Date;
}): Promise<ShiftAxDecisionRecord> {
  const records = await readDecisionRegister(rootDir);
  const record: ShiftAxDecisionRecord = {
    id: randomUUID(),
    title,
    summary,
    category,
    valid_from: validFrom,
    status: 'active',
    ...(sourceTopic ? { source_topic: sourceTopic } : {}),
    ...(sourceDoc ? { source_doc: sourceDoc } : {}),
    created_at: now.toISOString(),
  };
  records.push(record);
  await writeDecisionRegister(rootDir, records);
  return record;
}

export async function replaceDecision({
  rootDir,
  replacedDecisionId,
  title,
  summary,
  category,
  validFrom,
  sourceTopic,
  sourceDoc,
  now = new Date(),
}: {
  rootDir: string;
  replacedDecisionId: string;
  title: string;
  summary: string;
  category: string;
  validFrom: string;
  sourceTopic?: string;
  sourceDoc?: string;
  now?: Date;
}): Promise<ShiftAxDecisionRecord> {
  const records = await readDecisionRegister(rootDir);
  const replaced = records.find((record) => record.id === replacedDecisionId);
  if (!replaced) {
    throw new Error(`Decision not found: ${replacedDecisionId}`);
  }

  const replacement: ShiftAxDecisionRecord = {
    id: randomUUID(),
    title,
    summary,
    category,
    valid_from: validFrom,
    status: 'active',
    ...(sourceTopic ? { source_topic: sourceTopic } : {}),
    ...(sourceDoc ? { source_doc: sourceDoc } : {}),
    created_at: now.toISOString(),
  };

  replaced.status = 'superseded';
  replaced.valid_to = validFrom;
  replaced.replaced_by = replacement.id;
  records.push(replacement);
  await writeDecisionRegister(rootDir, records);
  return replacement;
}

function matchesActiveAt(record: ShiftAxDecisionRecord, activeAt?: string): boolean {
  if (!activeAt) return true;
  if (record.valid_from > activeAt) return false;
  if (record.valid_to && record.valid_to <= activeAt) return false;
  return true;
}

function matchesQuery(record: ShiftAxDecisionRecord, query?: string): boolean {
  if (!query) return true;
  const haystack = `${record.title}\n${record.summary}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .every((token) => haystack.includes(token));
}

export async function listDecisionRecords({
  rootDir,
  activeAt,
  query,
}: {
  rootDir: string;
  activeAt?: string;
  query?: string;
}): Promise<ShiftAxDecisionRecord[]> {
  const records = await readDecisionRegister(rootDir);
  return records
    .filter((record) => matchesActiveAt(record, activeAt))
    .filter((record) => matchesQuery(record, query));
}
