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

function scoreTopicTokens(queryTokens: string[], content: string): number {
  const haystack = new Set(tokenize(content));
  return queryTokens.reduce((score, token) => score + (haystack.has(token) ? 1 : 0), 0);
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
  if (limit <= 0) return [];

  const topicsRoot = join(rootDir, '.shift-ax', 'topics');
  const topicEntries = await readdir(topicsRoot, { withFileTypes: true }).catch(() => []);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const matches: ShiftAxPastTopicMatch[] = [];
  const directories = topicEntries.filter((entry) => entry.isDirectory());
  const batchSize = 16;

  async function readTopic(entryName: string): Promise<ShiftAxPastTopicMatch | null> {
    const topicDir = join(topicsRoot, entryName);
    const [request, summary, spec, workflowRaw] = await Promise.all([
      readFile(join(topicDir, 'request.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'request-summary.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'spec.md'), 'utf8').catch(() => ''),
      readFile(join(topicDir, 'workflow-state.json'), 'utf8').catch(() => ''),
    ]);

    if (!workflowRaw) return null;

    let workflow: { phase?: string; updated_at?: string };
    try {
      workflow = JSON.parse(workflowRaw) as { phase?: string; updated_at?: string };
    } catch {
      return null;
    }

    if (workflow.phase !== 'committed') return null;

    const score = scoreTopicTokens(queryTokens, [request, summary, spec].join('\n'));
    if (score <= 0) return null;

    return {
      topic_slug: entryName,
      summary: summary.trim(),
      request: request.trim(),
      score,
      updated_at: workflow.updated_at,
    };
  }

  for (let offset = 0; offset < directories.length; offset += batchSize) {
    const batch = directories.slice(offset, offset + batchSize);
    const batchMatches = await Promise.all(batch.map((entry) => readTopic(entry.name)));
    matches.push(...batchMatches.filter((match): match is ShiftAxPastTopicMatch => match !== null));
  }

  return matches
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''));
    })
    .slice(0, limit);
}
