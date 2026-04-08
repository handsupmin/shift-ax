import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { summarizeTopicStatus, type ShiftAxTopicStatusSummary } from './topic-status.js';

export interface ShiftAxTopicsStatusSummary extends ShiftAxTopicStatusSummary {
  topic_dir: string;
  updated_at: string;
}

export async function listTopicsStatus({
  rootDir,
  limit = 10,
}: {
  rootDir: string;
  limit?: number;
}): Promise<ShiftAxTopicsStatusSummary[]> {
  const topicsRoot = join(rootDir, '.ax', 'topics');
  const entries = await readdir(topicsRoot, { withFileTypes: true }).catch(() => []);
  const results: ShiftAxTopicsStatusSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const topicDir = join(topicsRoot, entry.name);
    const workflowRaw = await readFile(join(topicDir, 'workflow-state.json'), 'utf8').catch(() => '');
    if (!workflowRaw) continue;
    const workflow = JSON.parse(workflowRaw) as { updated_at?: string };
    const summary = await summarizeTopicStatus(topicDir);

    results.push({
      ...summary,
      topic_dir: topicDir,
      updated_at: workflow.updated_at ?? '',
    });
  }

  return results
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
    .slice(0, limit);
}
