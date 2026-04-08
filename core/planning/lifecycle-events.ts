import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ShiftAxReactionRecord {
  key: string;
  action: string;
  outcome: string;
  recorded_at: string;
}

export interface ShiftAxLifecycleEvent {
  phase: string;
  event: string;
  summary: string;
  recorded_at: string;
}

function lifecycleLogPath(topicDir: string): string {
  return join(topicDir, 'lifecycle-log.json');
}

function reactionLogPath(topicDir: string): string {
  return join(topicDir, 'reaction-log.json');
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function writeJsonArray(path: string, value: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function recordLifecycleEvent({
  topicDir,
  phase,
  event,
  summary,
  reaction,
  now = new Date(),
}: {
  topicDir: string;
  phase: string;
  event: string;
  summary: string;
  reaction?: Omit<ShiftAxReactionRecord, 'recorded_at'>;
  now?: Date;
}): Promise<void> {
  const events = await readJsonArray<ShiftAxLifecycleEvent>(lifecycleLogPath(topicDir));
  events.push({
    phase,
    event,
    summary,
    recorded_at: now.toISOString(),
  });
  await writeJsonArray(lifecycleLogPath(topicDir), events);

  if (reaction) {
    const reactions = await readJsonArray<ShiftAxReactionRecord>(reactionLogPath(topicDir));
    reactions.push({
      ...reaction,
      recorded_at: now.toISOString(),
    });
    await writeJsonArray(reactionLogPath(topicDir), reactions);
  }
}

export async function readLifecycleEvents(topicDir: string): Promise<ShiftAxLifecycleEvent[]> {
  return readJsonArray<ShiftAxLifecycleEvent>(lifecycleLogPath(topicDir));
}
