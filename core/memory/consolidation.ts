import { listDecisionRecords } from './decision-register.js';
import { listThreads } from './threads.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxMemoryConsolidationReport {
  duplicate_decisions: Array<{ title: string; count: number }>;
  repeated_topics: Array<{ summary: string; count: number }>;
  glossary_candidates: string[];
}

const GLOSSARY_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'always',
  'below',
  'carry',
  'entry',
  'issue',
  'migration',
  'needs',
  'notes',
  'shared',
  'should',
  'summary',
  'thread',
  'track',
]);

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function collectGlossaryTokens(content: string): string[] {
  const counts = new Map<string, number>();
  const relevantLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('- updated_at:'));

  for (const line of relevantLines) {
    const normalized = line.replace(/^-\s*\d{4}-\d{2}-\d{2}T[^:]+:\s*/, '');
    for (const token of normalized.match(/\b[a-zA-Z][a-zA-Z-]{5,}\b/g) ?? []) {
      const lower = token.toLowerCase();
      if (GLOSSARY_STOPWORDS.has(lower)) continue;
      counts.set(lower, (counts.get(lower) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDiff = right[1] - left[1];
      if (countDiff !== 0) return countDiff;
      return left[0].localeCompare(right[0]);
    })
    .map(([token]) => token)
    .slice(0, 10);
}

export async function consolidateMemory({
  rootDir,
}: {
  rootDir: string;
}): Promise<ShiftAxMemoryConsolidationReport> {
  const decisions = await listDecisionRecords({ rootDir });
  const decisionCounts = new Map<string, number>();
  for (const decision of decisions) {
    const key = decision.title.trim().toLowerCase();
    decisionCounts.set(key, (decisionCounts.get(key) ?? 0) + 1);
  }
  const duplicateDecisions = [...decisionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({ title, count }));

  const topicsRoot = join(rootDir, '.ax', 'topics');
  const topicEntries = await readdir(topicsRoot, { withFileTypes: true }).catch(() => []);
  const summaryCounts = new Map<string, number>();
  for (const entry of topicEntries) {
    if (!entry.isDirectory()) continue;
    const summary = (await readMaybe(join(topicsRoot, entry.name, 'request-summary.md')))
      .trim()
      .toLowerCase();
    if (!summary) continue;
    summaryCounts.set(summary, (summaryCounts.get(summary) ?? 0) + 1);
  }
  const repeatedTopics = [...summaryCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([summary, count]) => ({ summary, count }));

  const threads = await listThreads({ rootDir });
  const glossaryCandidates = new Set<string>();
  for (const thread of threads) {
    const content = await readMaybe(thread.path);
    for (const token of collectGlossaryTokens(content)) {
      glossaryCandidates.add(token);
      if (glossaryCandidates.size >= 10) break;
    }
  }

  return {
    duplicate_decisions: duplicateDecisions,
    repeated_topics: repeatedTopics,
    glossary_candidates: [...glossaryCandidates].slice(0, 10),
  };
}
