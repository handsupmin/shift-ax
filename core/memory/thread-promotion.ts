import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { bootstrapTopic } from '../topics/bootstrap.js';
import { findThread } from './threads.js';

export async function promoteThreadToTopic({
  rootDir,
  name,
  request,
}: {
  rootDir: string;
  name: string;
  request: string;
}): Promise<{ topicDir: string; topicSlug: string; supportPath: string }> {
  const threadSummary = await findThread({ rootDir, name });
  if (!threadSummary) {
    throw new Error(`Thread not found: ${name}`);
  }

  const thread = await readFile(threadSummary.path, 'utf8');
  const topic = await bootstrapTopic({
    rootDir,
    request,
  });
  const supportPath = join(topic.topicDir, 'support-thread.md');
  await writeFile(
    supportPath,
    `# Imported Support Thread\n\n- source_thread: ${threadSummary.name}\n- source_slug: ${threadSummary.slug}\n\n${thread.trim()}\n`,
    'utf8',
  );
  return {
    topicDir: topic.topicDir,
    topicSlug: topic.topicSlug,
    supportPath,
  };
}
