import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { searchDecisionMemory, type ShiftAxDecisionMemoryMatch } from '../memory/decision-register.js';
import { searchPastTopics, type ShiftAxPastTopicMatch } from '../memory/topic-recall.js';
import { getRootDirFromTopicDir } from '../topics/topic-artifacts.js';
import {
  parseIndexDocument,
  resolveContextFromIndex,
  type ResolvedContextMatch,
} from './index-resolver.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';

export interface ShiftAxContextBundleItem {
  label: string;
  content: string;
  path?: string;
  score?: number;
}

export interface ShiftAxContextBundleSection {
  kind: 'base_context' | 'reviewed_artifacts' | 'decision_memory' | 'topic_recall';
  title: string;
  items: ShiftAxContextBundleItem[];
}

export interface ShiftAxContextBundle {
  query: string;
  max_chars: number;
  total_source_chars: number;
  truncated: boolean;
  issues: string[];
  sections: ShiftAxContextBundleSection[];
  rendered: string;
}

export function classifyContextBundle(
  bundle: ShiftAxContextBundle,
): {
  status: 'ok' | 'warn' | 'critical';
  recommendation: string;
} {
  if (bundle.issues.length > 0) {
    return {
      status: 'critical',
      recommendation:
        'Base-context issues are present. Repair the shared docs or index before trusting this context bundle.',
    };
  }

  const ratio = bundle.total_source_chars / Math.max(bundle.max_chars, 1);
  if (bundle.truncated && ratio >= 1.5) {
    return {
      status: 'critical',
      recommendation:
        'The current context is far above the bundle budget. Split the work, pause safely, or build a smaller bundle.',
    };
  }

  if (bundle.truncated || ratio >= 1.0) {
    return {
      status: 'warn',
      recommendation:
        'The current context is approaching the bundle budget. Narrow the query or checkpoint the work soon.',
    };
  }

  return {
    status: 'ok',
    recommendation: 'The current context fits safely inside the bundle budget. Continue working.',
  };
}

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function loadBaseContextItems(rootDir: string, query: string): Promise<{
  items: ShiftAxContextBundleItem[];
  issues: string[];
}> {
  const home = getGlobalContextHome();
  const localIndexPath = join(rootDir, 'docs', 'base-context', 'index.md');
  const candidates = [
    { indexPath: localIndexPath, indexRootDir: rootDir, kind: 'local' as const },
    { indexPath: home.indexPath, indexRootDir: home.root, kind: 'global' as const },
  ];

  const candidateResults: Array<{ items: ShiftAxContextBundleItem[]; issues: string[] }> = [];

  for (const candidate of candidates) {
    const issues: string[] = [];
    const rawIndex = await readMaybe(candidate.indexPath);
    if (!rawIndex.trim()) {
      candidateResults.push({
        items: [],
        issues: candidate.kind === 'global' ? [] : [`Base-context index is missing or unreadable: ${candidate.indexPath}`],
      });
      continue;
    }

    const resolved = await resolveContextFromIndex({
      rootDir,
      indexPath: candidate.indexPath,
      indexRootDir: candidate.indexRootDir,
      query,
      maxMatches: 5,
    }).catch(() => ({
      matches: [],
      unresolved_paths: [],
    })) as { matches?: ResolvedContextMatch[]; unresolved_paths?: string[] };

    const directMatches = (resolved.matches ?? []).map((match) => ({
      label: match.label,
      path: match.path,
      score: match.score,
      content: match.content.trim(),
    }));
    if ((resolved.unresolved_paths ?? []).length > 0) {
      for (const path of resolved.unresolved_paths ?? []) {
        issues.push(`Base-context path could not be resolved: ${path}`);
      }
    }
    if (directMatches.length > 0) {
      candidateResults.push({ items: directMatches, issues });
      continue;
    }

    const queryTokens = tokenize(query);
    const entries = parseIndexDocument(rawIndex);
    const ranked: ShiftAxContextBundleItem[] = [];

    for (const entry of entries) {
      const content = await readMaybe(join(candidate.indexRootDir, entry.path));
      if (!content.trim()) continue;
      const haystack = new Set(tokenize(content));
      const score = queryTokens.reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0);
      if (score <= 0) continue;
      ranked.push({
        label: entry.label,
        path: entry.path,
        score,
        content: content.trim(),
      });
    }

    if (ranked.length === 0 && candidate.kind === 'local') {
      issues.push('No matching base-context documents were found for the current query.');
    }

    candidateResults.push({
      items: ranked.sort((left, right) => (right.score ?? 0) - (left.score ?? 0)).slice(0, 5),
      issues,
    });
  }

  const firstUseful = candidateResults.find((result) => result.items.length > 0);
  if (firstUseful) return firstUseful;
  return candidateResults[candidateResults.length - 1] ?? { items: [], issues: [] };
}

async function loadReviewedArtifactItems(topicDir: string | undefined): Promise<ShiftAxContextBundleItem[]> {
  if (!topicDir) return [];

  const requestSummary = await readMaybe(join(topicDir, 'request-summary.md'));
  const spec = await readMaybe(join(topicDir, 'spec.md'));
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const brainstorm = await readMaybe(join(topicDir, 'brainstorm.md'));

  const items: ShiftAxContextBundleItem[] = [];
  if (requestSummary.trim()) {
    items.push({
      label: 'Request Summary',
      path: 'request-summary.md',
      content: requestSummary.trim(),
    });
  }
  if (spec.trim()) {
    items.push({
      label: 'Reviewed Spec',
      path: 'spec.md',
      content: spec.trim(),
    });
  }
  if (plan.trim()) {
    items.push({
      label: 'Implementation Plan',
      path: 'implementation-plan.md',
      content: plan.trim(),
    });
  }
  if (brainstorm.trim()) {
    items.push({
      label: 'Brainstorm',
      path: 'brainstorm.md',
      content: brainstorm.trim(),
    });
  }
  return items;
}

function mapDecisionItems(matches: ShiftAxDecisionMemoryMatch[]): ShiftAxContextBundleItem[] {
  return matches.map((match) => ({
    label: match.title,
    path: match.source_doc,
    score: match.score,
    content: [
      match.summary.trim(),
      match.source_topic_summary?.trim() ? `Source topic summary: ${match.source_topic_summary.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }));
}

function mapTopicRecallItems(matches: ShiftAxPastTopicMatch[]): ShiftAxContextBundleItem[] {
  return matches.map((match) => ({
    label: match.topic_slug,
    score: match.score,
    content: [match.summary.trim(), match.request.trim()].filter(Boolean).join('\n'),
  }));
}

function trimToBudget(text: string, budget: number): string {
  if (budget <= 0) return '';
  if (text.length <= budget) return text;
  if (budget <= 3) return text.slice(0, budget);
  return `${text.slice(0, budget - 3).trimEnd()}...`;
}

function renderSectionHeader(title: string): string {
  return `## ${title}\n\n`;
}

function renderItem(item: ShiftAxContextBundleItem): string {
  const header = item.path ? `### ${item.label} (${item.path})\n\n` : `### ${item.label}\n\n`;
  return `${header}${item.content.trim()}\n\n`;
}

export async function buildContextBundle({
  rootDir,
  topicDir,
  query,
  maxChars = 6000,
}: {
  rootDir?: string;
  topicDir?: string;
  query: string;
  maxChars?: number;
}): Promise<ShiftAxContextBundle> {
  const effectiveRoot = rootDir || (topicDir ? getRootDirFromTopicDir(topicDir) : '');
  if (!effectiveRoot) {
    throw new Error('rootDir or topicDir is required');
  }

  const [baseContext, reviewedItems, decisionItems, topicRecallItems] = await Promise.all([
    loadBaseContextItems(effectiveRoot, query),
    loadReviewedArtifactItems(topicDir),
    searchDecisionMemory({
      rootDir: effectiveRoot,
      query,
      limit: 3,
    }).then(mapDecisionItems),
    searchPastTopics({
      rootDir: effectiveRoot,
      query,
      limit: 3,
    }).then(mapTopicRecallItems),
  ]);

  const plannedSections: ShiftAxContextBundleSection[] = [
    { kind: 'reviewed_artifacts', title: 'Reviewed Artifacts', items: reviewedItems },
    { kind: 'base_context', title: 'Base Context', items: baseContext.items },
    { kind: 'decision_memory', title: 'Decision Memory', items: decisionItems },
    { kind: 'topic_recall', title: 'Past Topic Recall', items: topicRecallItems },
  ];

  let remaining = maxChars;
  const sections: ShiftAxContextBundleSection[] = [];
  let rendered = '';
  const totalSourceChars = plannedSections
    .flatMap((section) => section.items)
    .reduce((sum, item) => sum + item.content.length, 0);

  const issues = [...baseContext.issues];
  if (issues.length > 0) {
    const issuesBlock = ['## Context Issues', '', ...issues.map((issue) => `- ${issue}`), '', ''].join('\n');
    rendered += trimToBudget(issuesBlock, remaining);
    remaining = maxChars - rendered.length;
  }

  for (const section of plannedSections) {
    if (remaining <= 0) break;

    const header = renderSectionHeader(section.title);
    if (header.length > remaining) break;

    let sectionRendered = header;
    let sectionRemaining = remaining - header.length;
    const keptItems: ShiftAxContextBundleItem[] = [];

    for (const item of section.items) {
      if (sectionRemaining <= 0) break;
      const renderedItem = renderItem(item);
      const trimmed = trimToBudget(renderedItem, sectionRemaining);
      if (!trimmed.trim()) break;

      sectionRendered += trimmed;
      keptItems.push({
        ...item,
        content: trimToBudget(item.content, Math.max(0, trimmed.length)),
      });
      sectionRemaining = maxChars - (rendered.length + sectionRendered).length;
    }

    if (keptItems.length === 0 && section.kind !== 'base_context') {
      continue;
    }

    rendered += sectionRendered;
    remaining = maxChars - rendered.length;
    sections.push({
      ...section,
      items: keptItems,
    });
  }

  return {
    query,
    max_chars: maxChars,
    total_source_chars: totalSourceChars,
    truncated: totalSourceChars > rendered.length,
    issues,
    sections,
    rendered: rendered.slice(0, maxChars),
  };
}

export async function writeContextBundle({
  rootDir,
  topicDir,
  query,
  maxChars = 6000,
  outputPath,
  workflowStep = 'general',
}: {
  rootDir?: string;
  topicDir?: string;
  query: string;
  maxChars?: number;
  outputPath?: string;
  workflowStep?: string;
}): Promise<{ bundle: ShiftAxContextBundle; output_path: string; status: 'ok' | 'warn' | 'critical' }> {
  const bundle = await buildContextBundle({
    rootDir,
    topicDir,
    query,
    maxChars,
  });
  const effectiveRoot = rootDir || (topicDir ? getRootDirFromTopicDir(topicDir) : '');
  const targetPath =
    outputPath || join(effectiveRoot, '.ax', 'context-bundles', `${slugify(query)}--${slugify(workflowStep)}.md`);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    `# Shift AX Context Bundle\n\n- workflow_step: ${workflowStep}\n- query: ${query}\n- max_chars: ${bundle.max_chars}\n\n${bundle.rendered.trim()}\n`,
    'utf8',
  );
  return {
    bundle,
    output_path: targetPath,
    status: classifyContextBundle(bundle).status,
  };
}
