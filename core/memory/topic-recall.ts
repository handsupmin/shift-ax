import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxPastTopicMatch {
  topic_slug: string;
  summary: string;
  request: string;
  score: number;
  updated_at?: string;
}

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreTopic(query: string, content: string): number {
  const haystack = new Set(tokenize(content));
  return tokenize(query).reduce((score, token) => score + (haystack.has(token) ? 1 : 0), 0);
}

export async function searchPastTopics({
  rootDir,
  query,
  limit = 5,
}: {
  rootDir: string;
  query: string;
  limit?: number;
}): Promise<ShiftAxPastTopicMatch[]> {
  const topicsRoot = join(rootDir, '.ax', 'topics');
  const topicEntries = await readdir(topicsRoot, { withFileTypes: true }).catch(() => []);
  const matches: ShiftAxPastTopicMatch[] = [];

  for (const entry of topicEntries) {
    if (!entry.isDirectory()) continue;
    const topicDir = join(topicsRoot, entry.name);
    const [request, summary, spec, workflowRaw] = await Promise.all([
      readFile(join(topicDir, 'request.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'request-summary.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'spec.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'workflow-state.json'), 'utf8').catch(() => ''),
    ]);

    if (!workflowRaw) continue;
    const workflow = JSON.parse(workflowRaw) as { phase?: string; updated_at?: string };
    if (workflow.phase !== 'committed') continue;

    const score = scoreTopic(query, [request, summary, spec].join('\n'));
    if (score <= 0) continue;

    matches.push({
      topic_slug: entry.name,
      summary: summary.trim(),
      request: request.trim(),
      score,
      updated_at: workflow.updated_at,
    });
  }

  return matches
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''));
    })
    .slice(0, limit);
}
