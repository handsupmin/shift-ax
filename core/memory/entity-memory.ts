import { searchDecisionMemory } from './decision-register.js';
import { listThreads } from './threads.js';
import { searchPastTopics } from './topic-recall.js';
import { readFile } from 'node:fs/promises';

export async function buildEntityMemoryView({
  rootDir,
  entity,
}: {
  rootDir: string;
  entity: string;
}): Promise<{
  entity: string;
  decisions: Awaited<ReturnType<typeof searchDecisionMemory>>;
  threads: Array<{ name: string; path: string }>;
  topics: Awaited<ReturnType<typeof searchPastTopics>>;
}> {
  const [decisions, threads, topics] = await Promise.all([
    searchDecisionMemory({ rootDir, query: entity, limit: 5 }),
    listThreads({ rootDir }),
    searchPastTopics({ rootDir, query: entity, limit: 5 }),
  ]);

  const normalizedEntity = entity.toLowerCase();
  const matchingThreads = (
    await Promise.all(
      threads.map(async (thread) => {
        const content = await readFile(thread.path, 'utf8').catch(() => '');
        if (!content.toLowerCase().includes(normalizedEntity)) {
          return null;
        }
        return { name: thread.name, path: thread.path };
      }),
    )
  ).filter((thread): thread is { name: string; path: string } => Boolean(thread));

  return {
    entity,
    decisions,
    threads: matchingThreads,
    topics,
  };
}
