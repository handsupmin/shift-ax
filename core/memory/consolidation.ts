import { listDecisionRecords } from './decision-register.js';
import { listThreads } from './threads.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxMemoryConsolidationReport {
  duplicate_decisions: Array<{ title: string; count: number }>;
  repeated_topics: Array<{ summary: string; count: number }>;
  glossary_candidates: string[];
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
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
    const matches = content.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g) ?? [];
    for (const match of matches) {
      if (match.length >= 6) {
        glossaryCandidates.add(match);
      }
    }
  }

  return {
    duplicate_decisions: duplicateDecisions,
    repeated_topics: repeatedTopics,
    glossary_candidates: [...glossaryCandidates].slice(0, 10),
  };
}
