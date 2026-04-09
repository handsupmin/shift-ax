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

export interface ShiftAxDecisionMemoryMatch extends ShiftAxDecisionRecord {
  score: number;
  source_topic_summary?: string;
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

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreDecision(query: string, content: string): number {
  const haystack = new Set(tokenize(content));
  return tokenize(query).reduce((score, token) => score + (haystack.has(token) ? 1 : 0), 0);
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

export async function searchDecisionMemory({
  rootDir,
  query,
  activeAt,
  limit = 5,
}: {
  rootDir: string;
  query: string;
  activeAt?: string;
  limit?: number;
}): Promise<ShiftAxDecisionMemoryMatch[]> {
  const records = await listDecisionRecords({
    rootDir,
    activeAt,
  });
  const matches: ShiftAxDecisionMemoryMatch[] = [];

  for (const record of records) {
    const topicSummary = record.source_topic
      ? await readFile(join(rootDir, '.ax', 'topics', record.source_topic, 'request-summary.md'), 'utf8').catch(
          () => '',
        )
      : '';
    const topicRequest = record.source_topic
      ? await readFile(join(rootDir, '.ax', 'topics', record.source_topic, 'request.md'), 'utf8').catch(() => '')
      : '';
    const topicSpec = record.source_topic
      ? await readFile(join(rootDir, '.ax', 'topics', record.source_topic, 'spec.md'), 'utf8').catch(() => '')
      : '';

    const score = scoreDecision(
      query,
      [
        record.title,
        record.summary,
        record.category,
        record.source_doc ?? '',
        record.source_topic ?? '',
        topicSummary,
        topicRequest,
        topicSpec,
      ].join('\n'),
    );

    if (score <= 0) continue;

    matches.push({
      ...record,
      score,
      ...(topicSummary.trim() ? { source_topic_summary: topicSummary.trim() } : {}),
    });
  }

  return matches
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;
      return String(right.valid_from).localeCompare(String(left.valid_from));
    })
    .slice(0, limit);
}
