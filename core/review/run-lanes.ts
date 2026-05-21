import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename as pathBasename, join, resolve } from 'node:path';

import type { ReviewVerdict } from './aggregate-reviews.js';
import { runIndependentReviewGate } from './independent-review.js';
import { readProjectProfile, type ShiftAxRepositoryReviewGate } from '../policies/project-profile.js';
import {
  extractExecutionTaskLines,
  extractMarkdownBullets,
  listMissingImplementationPlanSections,
  parseExecutionLaneMetadata,
  parseMarkdownSections,
  readPlanSection,
} from '../planning/implementation-plan.js';
import { readPlanReviewArtifact, verifyApprovedPlanFingerprint } from '../planning/plan-review.js';
import {
  assessTopicPlanningReadiness,
  type ShiftAxPlanningReadinessAssessment,
} from '../planning/readiness-assessment.js';
import { getRootDirFromTopicDir } from '../topics/topic-artifacts.js';

export interface RunReviewLanesInput {
  topicDir: string;
}

function containsPlaceholder(content: string): boolean {
  return /Shift AX placeholder/i.test(content);
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function verdictBase(
  lane: string,
  status: ReviewVerdict['status'],
  summary: string,
  issues: ReviewVerdict['issues'] = [],
): ReviewVerdict {
  return {
    version: 1,
    lane,
    status,
    checked_at: new Date().toISOString(),
    summary,
    ...(issues.length > 0 ? { issues } : {}),
  };
}

function tokenizeReviewWords(value: string): string[] {
  const stopWords = new Set([
    'and',
    'for',
    'the',
    'that',
    'this',
    'with',
    'from',
    'into',
    'when',
    'then',
    'keep',
    'true',
    'false',
    'const',
    'export',
    'import',
    'class',
    'function',
    'return',
    'async',
    'await',
    'test',
    'tests',
    'describe',
    'should',
    'expect',
    'assert',
    'applies',
    'apply',
    'behavior',
    'implemented',
    'implement',
    'introduced',
    'introduce',
    'recorded',
    'record',
    'safely',
    'string',
    'number',
    'null',
    'undefined',
    'default',
    'public',
    'private',
    'static',
    'updated',
    'update',
    'works',
  ]);

  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= (/[가-힣]/.test(token) ? 2 : 4))
    .filter((token) => !stopWords.has(token));
}

function hasTokenOverlap(content: string, reference: string): boolean {
  const haystack = String(content || '').toLowerCase();
  return tokenizeReviewWords(reference).some((token) => haystack.includes(token));
}

function countSharedReviewTokens(content: string, reference: string): number {
  const referenceTokens = new Set(tokenizeReviewWords(reference));
  const contentTokens = new Set(tokenizeReviewWords(content));
  let count = 0;
  for (const token of referenceTokens) {
    if (contentTokens.has(token)) count += 1;
  }
  return count;
}

function hasMeaningfulEvidence(content: string, reference: string): boolean {
  const referenceTokens = [...new Set(tokenizeReviewWords(reference))];
  if (referenceTokens.length === 0) return false;
  const shared = countSharedReviewTokens(content, reference);
  return shared >= Math.min(3, referenceTokens.length);
}

function normalizeReviewLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReviewableRequirement(line: string): boolean {
  const normalized = normalizeReviewLine(line);
  if (normalized.length < 8) return false;
  if (/^(none|n\/a|na|tbd|todo|decide later|work on it|improve it)\.?$/i.test(normalized)) {
    return false;
  }
  return tokenizeReviewWords(normalized).length >= 1;
}

function extractReviewableLines(value: string): string[] {
  const bullets = extractMarkdownBullets(value).map(normalizeReviewLine);
  const plainLines = String(value || '')
    .split(/\r?\n/)
    .map(normalizeReviewLine)
    .filter((line) => line && !/^#+\s+/.test(line));
  return [...new Set([...bullets, ...plainLines].filter(isReviewableRequirement))];
}

function extractSectionRequirements(markdown: string, sectionNames: string[]): string[] {
  const sections = parseMarkdownSections(markdown);
  return [
    ...new Set(
      sectionNames.flatMap((section) => extractReviewableLines(readPlanSection(sections, section))),
    ),
  ];
}

function extractPrdRequirements({
  spec,
  plan,
  brainstorm,
}: {
  spec: string;
  plan: string;
  brainstorm: string;
}): string[] {
  return [
    ...new Set([
      ...extractSectionRequirements(plan, ['Acceptance Criteria']),
      ...extractSectionRequirements(spec, ['Acceptance Criteria', 'Goal', 'Constraints']),
      ...extractSectionRequirements(brainstorm, ['Clarified Outcome', 'Constraints']),
    ]),
  ];
}

function extractContextRuleLines(content: string): string[] {
  const withoutDedicatedRepoGate = stripMarkdownSection(content, 'Mandatory Repo Review Gate');
  return extractReviewableLines(withoutDedicatedRepoGate)
    .filter((line) =>
      /\b(must|shall|required|never|always|avoid|follow|verify|tdd|architecture|boundary|convention|commit|review|build|lint|type[- ]?check)\b|\btests?\b.*\b(together|before|after|with)\b|\b(test|verify)\b.*\b(before|after|commit|release)\b|반드시|금지|항상|따르|준수|검증|테스트|컨벤션|규칙|리뷰|커밋|아키텍처|경계|빌드|린트/i.test(
        line,
      ),
    )
    .slice(0, 12);
}

function stripMarkdownSection(content: string, heading: string): string {
  const lines = String(content || '').split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;
  const headingPattern = new RegExp(`^##\\s+${heading.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`, 'i');

  for (const line of lines) {
    if (headingPattern.test(line.trim())) {
      skipping = true;
      continue;
    }
    if (skipping && /^##\s+/.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join('\n');
}

function basenameWithoutExtension(path: string): string {
  const normalized = normalizeReviewPath(path);
  const basename = normalized.split('/').filter(Boolean).pop() ?? normalized;
  return basename.replace(/\.[A-Za-z0-9]+$/, '');
}

function normalizeReviewPath(path: string): string {
  return path
    .trim()
    .replace(/^["'`]+|["'`,.;:]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
}

function extractPathReferences(value: string): string[] {
  const matches =
    String(value || '').match(/[A-Za-z0-9_@./{}*-]+(?:\/[A-Za-z0-9_@./{}*-]+|\.[A-Za-z0-9]+)[A-Za-z0-9_@./{}*-]*/g) ?? [];
  return matches
    .map(normalizeReviewPath)
    .filter(Boolean)
    .filter((path) => !/^none$/i.test(path))
    .filter((path) => !/^https?:\/\//i.test(path));
}

function extractPlannedPathReferences(plan: string): string[] {
  const sections = parseMarkdownSections(plan);
  const likelyFiles = readPlanSection(sections, 'Likely Files Touched');
  const executionLanes = readPlanSection(sections, 'Execution Lanes (Optional)', 'Execution Lanes');
  const laneMetadata = parseExecutionLaneMetadata(plan);
  const references = [
    ...extractMarkdownBullets(likelyFiles).flatMap(extractPathReferences),
    ...extractPathReferences(executionLanes),
    ...[...laneMetadata.values()].flatMap((metadata) => metadata.allowed_paths ?? []),
  ];
  return [...new Set(references.map(normalizeReviewPath).filter(Boolean))];
}

function wildcardPathToRegExp(path: string): RegExp {
  const escaped = path
    .split('*')
    .map((part) => part.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

function plannedPathMatchesFile(file: string, reference: string): boolean {
  const normalizedFile = normalizeReviewPath(file);
  const normalizedReference = normalizeReviewPath(reference);
  if (!normalizedReference) return false;
  if (normalizedReference.includes('*')) {
    return wildcardPathToRegExp(normalizedReference).test(normalizedFile);
  }
  return (
    normalizedFile === normalizedReference ||
    normalizedFile.startsWith(`${normalizedReference.replace(/\/$/, '')}/`) ||
    (normalizedReference.startsWith('**/') && normalizedFile.endsWith(normalizedReference.slice(3)))
  );
}

function isExplicitlyInScopeFile(file: string, plan: string): boolean {
  const pathReferences = extractPlannedPathReferences(plan);
  if (pathReferences.some((reference) => plannedPathMatchesFile(file, reference))) {
    return true;
  }
  return hasTokenOverlap(file, pathReferences.join('\n'));
}

function buildPlanCompletionAudit({
  plan,
  changedFiles,
  executionResults,
}: {
  plan: string;
  changedFiles: string[];
  executionResults: string[];
}): {
  overall_status: 'not_started' | 'partial' | 'done';
  summary: string;
  items: Array<{
    task_id: string;
    task: string;
    status: 'not_started' | 'missing' | 'done';
    evidence_files: string[];
  }>;
} {
  const tasks = extractExecutionTaskLines(plan);
  const mentionedFiles = extractMentionedFilesFromExecutionResults(executionResults);
  const evidenceText = [changedFiles.join('\n'), ...executionResults].join('\n');
  const items: Array<{
    task_id: string;
    task: string;
    status: 'not_started' | 'missing' | 'done';
    evidence_files: string[];
  }> = tasks.map((task, index) => {
    const evidenceFiles = mentionedFiles.filter(
      (file) => hasTokenOverlap(file, task) || hasTokenOverlap(task, file),
    );
    const matched = hasTokenOverlap(evidenceText, task) || evidenceFiles.length > 0;
    return {
      task_id: `task-${index + 1}`,
      task,
      status: matched
        ? 'done'
        : changedFiles.length === 0
          ? 'not_started'
          : 'missing',
      evidence_files: evidenceFiles,
    };
  });
  const doneCount = items.filter((item) => item.status === 'done').length;
  const overallStatus =
    items.length === 0 || doneCount === 0
      ? changedFiles.length === 0
        ? 'not_started'
        : 'partial'
      : doneCount === items.length
        ? 'done'
        : 'partial';

  return {
    overall_status: overallStatus,
    summary:
      items.length === 0
        ? 'No execution tasks were recorded in the implementation plan.'
        : `${doneCount}/${items.length} execution tasks have matching evidence in the current worktree or execution results.`,
    items,
  };
}

async function readWorkflowStateMaybe(topicDir: string): Promise<{
  verification?: Array<{ command: string; exit_code: number; stdout?: string; stderr?: string }>;
  worktree?: { worktree_path?: string };
} | null> {
  const raw = await readMaybe(join(topicDir, 'workflow-state.json'));
  if (!raw) return null;
  return JSON.parse(raw) as {
    verification?: Array<{ command: string; exit_code: number; stdout?: string; stderr?: string }>;
    worktree?: { worktree_path?: string };
  };
}

async function readExecutionStateMaybe(topicDir: string): Promise<{
  overall_status?: string;
  tasks?: Array<{ output_path?: string }>;
} | null> {
  const raw = await readMaybe(join(topicDir, 'execution-state.json'));
  if (!raw) return null;
  return JSON.parse(raw) as {
    overall_status?: string;
    tasks?: Array<{ output_path?: string }>;
  };
}

async function readExecutionResultArtifacts(topicDir: string): Promise<string[]> {
  const executionState = await readExecutionStateMaybe(topicDir);
  const outputPaths = (executionState?.tasks ?? [])
    .map((task) => task.output_path)
    .filter((path): path is string => Boolean(path));

  return Promise.all(
    outputPaths.map(async (path) => {
      const resolved = path.startsWith('/') ? path : join(topicDir, path);
      return readMaybe(resolved);
    }),
  );
}

function extractMentionedFilesFromExecutionResults(results: string[]): string[] {
  const mentioned = new Set<string>();

  for (const result of results) {
    if (!result.trim()) continue;
    try {
      const parsed = JSON.parse(result) as { changed_files?: string[]; summary?: string };
      for (const file of parsed.changed_files ?? []) {
        if (file) mentioned.add(file);
      }
      const summary = parsed.summary ?? '';
      const summaryMatches = summary.match(/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g) ?? [];
      for (const file of summaryMatches) {
        mentioned.add(file);
      }
      continue;
    } catch {
      const matches = result.match(/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g) ?? [];
      for (const file of matches) {
        mentioned.add(file);
      }
    }
  }

  return [...mentioned];
}

function listChangedFiles(worktreePath: string): string[] {
  const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: worktreePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[A-Z?]{1,2}\s+/, ''))
    .filter(Boolean);
}

function isTestFile(path: string): boolean {
  return (
    /(^|\/)(tests?|__tests__)\//i.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path) ||
    /(^|\/)(test_[^/]+|[^/]+_test)\.py$/i.test(path)
  );
}

function needsChangedTestEvidence(path: string): boolean {
  if (isTestFile(path)) return false;
  if (/(^|\/)(docs?|readme|changelog)\//i.test(path) || /\.(md|mdx|txt|png|jpe?g|gif|svg|webp)$/i.test(path)) {
    return false;
  }
  return /\.(cjs|cts|go|graphql|java|js|jsx|kt|mjs|mts|php|prisma|py|rb|rs|sql|swift|ts|tsx)$/i.test(path);
}

function classifySideEffectRisk(path: string): Array<{
  category: string;
  verificationPattern: RegExp;
}> {
  const normalized = normalizeReviewPath(path);
  const risks: Array<{ category: string; verificationPattern: RegExp }> = [];

  if (/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|requirements\.txt|poetry\.lock|pyproject\.toml)$/i.test(normalized)) {
    risks.push({
      category: 'dependency or package metadata',
      verificationPattern: /\b(build|type-?check|tsc|lint|test|prepack)\b/i,
    });
  }
  if (/(^|\/)(Dockerfile|docker-compose|tsconfig|vite\.config|webpack|rollup|eslint|prettier|babel|jest|vitest|next\.config)/i.test(normalized)) {
    risks.push({
      category: 'runtime or build configuration',
      verificationPattern: /\b(build|type-?check|tsc|lint|test|prepack)\b/i,
    });
  }
  if (/(^|\/)(\.github|k8s|helm|terraform|infra|deploy|charts|ops)\//i.test(normalized)) {
    risks.push({
      category: 'deployment or infrastructure surface',
      verificationPattern: /\b(build|lint|test|plan|validate|dry[- ]?run)\b/i,
    });
  }
  if (/(^|\/)(migration|migrations|schema|prisma)\//i.test(normalized) || /\.(prisma|sql)$/i.test(normalized) || /(^|\/)(model\.py|alembic\.ini)$/i.test(normalized)) {
    risks.push({
      category: 'database schema or migration surface',
      verificationPattern: /\b(test|pytest|unittest|migration|prisma|schema|compile|py_compile|pg|dto)\b/i,
    });
  }
  if (/(^|\/)(auth|security|permission|policy|role|payment|billing|wallet|ledger|cron|worker|queue)[A-Za-z0-9_.-]*/i.test(normalized)) {
    risks.push({
      category: 'security, money, scheduled, or background side-effect surface',
      verificationPattern: /\b(build|type-?check|tsc|lint|test|pytest|unittest|vitest|jest)\b/i,
    });
  }

  return risks;
}

function hasRiskMitigationLanguage(...values: string[]): boolean {
  return /\b(side[- ]?effect|risk|risky|rollback|compatib|backward|forward|migration|schema|database|permission|auth|security|deploy|release|config|environment|generated|manual|staging|nullable|impact)\b|사이드|위험|리스크|롤백|호환|마이그레이션|스키마|권한|인증|보안|배포|환경|수동|스테이징|안전/i.test(
    values.join('\n'),
  );
}

function hasPassingVerificationMatching(
  workflow: { verification?: Array<{ command: string; exit_code: number }> } | null,
  pattern: RegExp,
): boolean {
  return (workflow?.verification ?? []).some(
    (item) => item.exit_code === 0 && pattern.test(item.command),
  );
}

function strategyPattern(value: string): RegExp {
  const normalized = value.toLowerCase();
  if (normalized === 'tdd') {
    return /\btdd\b|test[- ]driven/i;
  }
  return new RegExp(normalized.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/-/g, '[- ]?'), 'i');
}

async function readProjectProfileForTopic(topicDir: string) {
  try {
    return await readProjectProfile(getRootDirFromTopicDir(topicDir));
  } catch {
    return null;
  }
}

function architecturePattern(value: string): RegExp {
  const normalized = value.toLowerCase();
  if (normalized === 'clean-boundaries') {
    return /\b(boundary|boundaries|architecture)\b/i;
  }
  if (normalized === 'layered-boundaries') {
    return /\b(layered|boundary|boundaries|architecture)\b/i;
  }
  return new RegExp(normalized.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/-/g, '[- ]?'), 'i');
}

function shouldInspectEngineeringFile(path: string): boolean {
  if (/(^|\/)(docs?|readme|changelog)\//i.test(path) || /\.(md|mdx|txt|png|jpe?g|gif|svg|webp)$/i.test(path)) {
    return false;
  }
  return /\.(cjs|cts|go|java|js|jsx|kt|mjs|mts|php|py|rb|rs|sql|swift|ts|tsx)$/i.test(path);
}

function findFirstMatchingLine(content: string, pattern: RegExp): number | undefined {
  const lines = String(content || '').split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : undefined;
}

function inspectEngineeringFile(file: string, content: string): NonNullable<ReviewVerdict['issues']> {
  const checks: Array<{ pattern: RegExp; severity: 'high' | 'medium'; message: string }> = [
    {
      pattern: /\bdebugger\b/,
      severity: 'high',
      message: 'Debug breakpoint left in changed code.',
    },
    {
      pattern: /\b(?:describe|it|test)\.only\s*\(|\b(?:fit|fdescribe)\s*\(/,
      severity: 'high',
      message: 'Focused test marker would skip the real suite.',
    },
    {
      pattern: /\b(?:TODO|FIXME|HACK)\b|throw new Error\(\s*['"`](?:todo|not implemented|implement me)/i,
      severity: 'medium',
      message: 'Placeholder or unfinished implementation marker remains in changed code.',
    },
    {
      pattern: /\bconsole\.(?:log|debug)\s*\(/,
      severity: 'medium',
      message: 'Debug logging remains in changed code.',
    },
  ];

  return checks
    .map((check) => ({
      check,
      line: findFirstMatchingLine(content, check.pattern),
    }))
    .filter((item): item is { check: typeof checks[number]; line: number } => Boolean(item.line))
    .map(({ check, line }) => ({
      severity: check.severity,
      message: `${check.message} (${file}:${line})`,
    }));
}

async function runDomainPolicyLane(topicDir: string): Promise<ReviewVerdict> {
  const raw = await readMaybe(join(topicDir, 'resolved-context.json'));
  if (!raw) {
    return verdictBase('domain-policy', 'changes_requested', 'Resolved context artifact is missing.', [
      { severity: 'high', message: 'resolved-context.json is required before review.' },
    ]);
  }

  const parsed = JSON.parse(raw) as {
    unresolved_paths?: string[];
    matches?: Array<unknown>;
  };

  const unresolved = parsed.unresolved_paths ?? [];
  if (unresolved.length > 0) {
    return verdictBase(
      'domain-policy',
      'changes_requested',
      'Some base-context paths could not be resolved.',
      unresolved.map((path) => ({
        severity: 'high' as const,
        message: `Unresolved base-context path: ${path}`,
      })),
    );
  }

  return verdictBase(
    'domain-policy',
    'approved',
    parsed.matches && parsed.matches.length > 0
      ? 'Relevant base-context documents were resolved and no unresolved paths were recorded.'
      : 'No relevant base-context documents matched this topic, and no unresolved paths were recorded.',
  );
}

function parseResolvedContextMatches(raw: string): Array<{
  label?: string;
  path?: string;
  content?: string;
}> {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as {
      matches?: Array<{ label?: string; path?: string; content?: string }>;
    };
    return parsed.matches ?? [];
  } catch {
    return [];
  }
}

async function runOnboardingComplianceLane(topicDir: string): Promise<ReviewVerdict> {
  const [resolvedContext, spec, plan, brainstorm] = await Promise.all([
    readMaybe(join(topicDir, 'resolved-context.json')),
    readMaybe(join(topicDir, 'spec.md')),
    readMaybe(join(topicDir, 'implementation-plan.md')),
    readMaybe(join(topicDir, 'brainstorm.md')),
  ]);

  if (!resolvedContext.trim()) {
    return verdictBase(
      'onboarding-compliance',
      'changes_requested',
      'Resolved onboarding context is missing, so rule compliance cannot be reviewed.',
      [
        {
          severity: 'high',
          message: 'Resolve global onboarding context before implementation review can pass.',
        },
      ],
    );
  }

  const matches = parseResolvedContextMatches(resolvedContext);
  if (matches.length === 0) {
    return {
      ...verdictBase(
        'onboarding-compliance',
        'approved',
        'No matched onboarding context documents were recorded for this topic.',
      ),
      matched_context_count: 0,
    };
  }

  const specSections = parseMarkdownSections(spec);
  const planSections = parseMarkdownSections(plan);
  const brainstormSections = parseMarkdownSections(brainstorm);
  const planningCorpus = [spec, plan, brainstorm].join('\n');
  const outOfScopeCorpus = [
    readPlanSection(specSections, 'Out of Scope'),
    readPlanSection(brainstormSections, 'Out of Scope'),
    readPlanSection(planSections, 'Checkpoints'),
  ].join('\n');
  const issues = matches.flatMap((match) => {
    const label = match.label ?? '';
    const path = match.path ?? '';
    const contextName = label || path || '(unlabeled context)';
    const hasContextContent = Boolean(match.content?.trim());
    const nameReferences = [label, path, basenameWithoutExtension(path)].filter(Boolean);
    const nameMentioned = nameReferences.some((reference) =>
      hasMeaningfulEvidence(planningCorpus, reference) || planningCorpus.toLowerCase().includes(reference.toLowerCase()),
    );
    const contextMarkedOutOfScope = nameReferences.some((reference) =>
      hasMeaningfulEvidence(outOfScopeCorpus, reference) ||
      outOfScopeCorpus.toLowerCase().includes(reference.toLowerCase()),
    );
    const ruleLines = extractContextRuleLines(match.content ?? '');
    const missingRules = contextMarkedOutOfScope
      ? []
      : ruleLines.filter((rule) => !hasMeaningfulEvidence(planningCorpus, rule));

    return [
      ...(nameMentioned || hasContextContent
        ? []
        : [{
            severity: 'high' as const,
            message: `Matched onboarding context is not referenced in spec, brainstorm, or implementation plan: ${contextName}`,
          }]),
      ...missingRules.map((rule) => ({
        severity: 'high' as const,
        message: `Onboarding rule is not reflected in spec or implementation plan (${contextName}): ${rule}`,
      })),
    ];
  });

  if (issues.length > 0) {
    return verdictBase(
      'onboarding-compliance',
      'changes_requested',
      'Matched onboarding context exists, but the spec or implementation plan does not carry the required rules forward.',
      issues,
    );
  }

  return {
    ...verdictBase(
      'onboarding-compliance',
      'approved',
      'Matched onboarding context is referenced by the review artifacts, and extracted rule lines are reflected before implementation review.',
    ),
    matched_context_count: matches.length,
    extracted_rule_count: matches.reduce(
      (sum, match) => sum + extractContextRuleLines(match.content ?? '').length,
      0,
    ),
  };
}

function normalizeAbsoluteReviewPath(path: string): string {
  return resolve(path).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function reviewGateMatchesRoot(gate: ShiftAxRepositoryReviewGate, rootDir: string): boolean {
  const rootBase = pathBasename(rootDir).toLowerCase();
  if (gate.repository_path && normalizeAbsoluteReviewPath(gate.repository_path) === normalizeAbsoluteReviewPath(rootDir)) {
    return true;
  }
  if ((gate.repository || '').toLowerCase() === rootBase) {
    return true;
  }
  if (gate.repository_path && pathBasename(gate.repository_path).toLowerCase() === rootBase) {
    return true;
  }
  return false;
}

function hasGateCategoryEvidence({
  corpus,
  gateText,
  fallbackPattern,
}: {
  corpus: string;
  gateText: string;
  fallbackPattern: RegExp;
}): boolean {
  return hasMeaningfulEvidence(corpus, gateText) || fallbackPattern.test(corpus);
}

async function runRepositoryReviewGateLane(topicDir: string): Promise<ReviewVerdict> {
  let rootDir: string;
  try {
    rootDir = getRootDirFromTopicDir(topicDir);
  } catch {
    return verdictBase(
      'repository-review-gate',
      'approved',
      'Standalone review fixture is not inside .shift-ax/topics; repo-specific gate enforcement applies to real onboarded topics.',
    );
  }

  const profile = await readProjectProfileForTopic(topicDir);
  if (!profile) {
    return verdictBase(
      'repository-review-gate',
      'approved',
      'No onboarding profile is available for this standalone review fixture; repo-specific gate enforcement applies after onboarding creates repository_review_gates.',
    );
  }

  const configuredGates = profile?.repository_review_gates ?? [];
  if (configuredGates.length === 0) {
    return verdictBase(
      'repository-review-gate',
      'changes_requested',
      'No repo-specific review gates were found in the onboarding profile.',
      [
        {
          severity: 'high',
          message: 'Run onboarding again so Shift AX can infer mandatory repo review gates from merged PR history and onboarding rules.',
        },
      ],
    );
  }

  const gates =
    configuredGates.filter((gate) => reviewGateMatchesRoot(gate, rootDir)) ||
    [];
  const selectedGates = gates.length > 0 ? gates : configuredGates.length === 1 ? configuredGates : [];

  if (selectedGates.length === 0) {
    return verdictBase(
      'repository-review-gate',
      'changes_requested',
      'Onboarding has repo review gates, but none match the current repository.',
      configuredGates.map((gate) => ({
        severity: 'high' as const,
        message: `Repo gate does not match current root ${rootDir}: ${gate.repository_path || gate.repository}`,
      })),
    );
  }

  const [spec, plan, brainstorm, resolvedContext] = await Promise.all([
    readMaybe(join(topicDir, 'spec.md')),
    readMaybe(join(topicDir, 'implementation-plan.md')),
    readMaybe(join(topicDir, 'brainstorm.md')),
    readMaybe(join(topicDir, 'resolved-context.json')),
  ]);
  const corpus = [spec, plan, brainstorm, resolvedContext].join('\n');
  const issues: NonNullable<ReviewVerdict['issues']> = [];

  for (const gate of selectedGates) {
    const categories: Array<{
      label: keyof Pick<
        ShiftAxRepositoryReviewGate,
        'architecture' | 'working_process' | 'conventions' | 'side_effects'
      >;
      items: string[];
      fallbackPattern: RegExp;
    }> = [
      {
        label: 'architecture',
        items: gate.architecture,
        fallbackPattern: /\b(architecture|architectural|boundary|boundaries|layer|module|service|controller|domain|schema|worker|queue)\b|아키텍처|경계|레이어|서비스|컨트롤러|워커|큐/i,
      },
      {
        label: 'working_process',
        items: gate.working_process,
        fallbackPattern: /\b(verification|verify|test|lint|type[- ]?check|build|migration|review|commit|evidence)\b|검증|테스트|리뷰|커밋|빌드|린트/i,
      },
      {
        label: 'conventions',
        items: gate.conventions,
        fallbackPattern: /\b(convention|conventions|guardrail|guardrails|naming|generated|dto|schema|prisma|controller|service|test placement|native)\b|컨벤션|규칙|가드레일|생성|네이밍/i,
      },
      {
        label: 'side_effects',
        items: gate.side_effects,
        fallbackPattern: /\b(side[- ]?effect|risk|rollback|deploy|migration|schema|queue|worker|cache|auth|permission|external|idempot|data integrity)\b|사이드|리스크|위험|롤백|배포|마이그레이션|스키마|큐|워커|권한/i,
      },
    ];

    for (const category of categories) {
      if (category.items.length === 0) {
        issues.push({
          severity: 'high',
          message: `Repo review gate for ${gate.repository} has no ${category.label} checks.`,
        });
        continue;
      }
      if (
        !hasGateCategoryEvidence({
          corpus,
          gateText: category.items.join('\n'),
          fallbackPattern: category.fallbackPattern,
        })
      ) {
        issues.push({
          severity: 'high',
          message: `Plan artifacts do not show evidence that the ${gate.repository} ${category.label} review gate was considered.`,
        });
      }
    }
  }

  if (issues.length > 0) {
    return verdictBase(
      'repository-review-gate',
      'changes_requested',
      'Repo-specific onboarding review gate did not pass for the current request.',
      issues,
    );
  }

  return {
    ...verdictBase(
      'repository-review-gate',
      'approved',
      'Repo-specific onboarding review gate categories are configured and reflected in the planning artifacts.',
    ),
    repository_gate_count: selectedGates.length,
    checked_repositories: selectedGates.map((gate) => gate.repository),
  };
}

async function readOrBuildReadinessAssessment(
  topicDir: string,
): Promise<ShiftAxPlanningReadinessAssessment> {
  return assessTopicPlanningReadiness({ topicDir });
}

async function runPlanningReadinessLane(topicDir: string): Promise<ReviewVerdict> {
  const assessment = await readOrBuildReadinessAssessment(topicDir);

  if (assessment.status !== 'ready') {
    return verdictBase(
      'planning-readiness',
      'changes_requested',
      `Planning ambiguity score ${assessment.ambiguity_score} exceeds readiness requirements.`,
      (assessment.blockers.length > 0 ? assessment.blockers : ['Planning readiness assessment is not ready.']).map((blocker) => ({
        severity: 'high' as const,
        message: blocker,
      })),
    );
  }

  return {
    ...verdictBase(
      'planning-readiness',
      'approved',
      `Planning ambiguity score ${assessment.ambiguity_score} is at or below ${assessment.ambiguity_threshold}.`,
    ),
    ambiguity_score: assessment.ambiguity_score,
    ambiguity_threshold: assessment.ambiguity_threshold,
    dimensions: assessment.dimensions,
  };
}

async function runSpecConformanceLane(topicDir: string): Promise<ReviewVerdict> {
  const spec = await readMaybe(join(topicDir, 'spec.md'));
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const planReview = await readPlanReviewArtifact(topicDir);
  const workflow = await readWorkflowStateMaybe(topicDir);

  if (planReview.status !== 'approved') {
    return verdictBase(
      'spec-conformance',
      'changes_requested',
      'Human plan review has not approved the current implementation plan yet.',
      [
        {
          severity: 'high',
          message: 'Approve plan-review.json before review can pass.',
        },
      ],
    );
  }

  const fingerprint = await verifyApprovedPlanFingerprint({ topicDir });
  if (!fingerprint.matches) {
    return verdictBase(
      'spec-conformance',
      'changes_requested',
      'The implementation plan changed after approval and needs re-review.',
      [
        {
          severity: 'high',
          message: fingerprint.reason ?? 'Approved plan fingerprint no longer matches.',
        },
      ],
    );
  }

  if (containsPlaceholder(spec) || containsPlaceholder(plan)) {
    return verdictBase(
      'spec-conformance',
      'changes_requested',
      'Spec or implementation plan still contains placeholders.',
      [
        {
          severity: 'high',
          message: 'Replace placeholder content in spec.md and implementation-plan.md before review can pass.',
        },
      ],
    );
  }

  const missingPlanSections = listMissingImplementationPlanSections(plan);
  if (missingPlanSections.length > 0) {
    return verdictBase(
      'spec-conformance',
      'changes_requested',
      'Implementation plan is missing required execution sections.',
      missingPlanSections.map((section) => ({
        severity: 'high' as const,
        message: `Required implementation-plan section is missing or empty: ${section}.`,
      })),
    );
  }

  const worktreePath = workflow?.worktree?.worktree_path;
  if (worktreePath) {
    const changedFiles = listChangedFiles(worktreePath);
    const executionState = await readExecutionStateMaybe(topicDir);
    const outOfScopeContent =
      parseMarkdownSections(spec).get('Out of Scope') ??
      parseMarkdownSections(await readMaybe(join(topicDir, 'brainstorm.md'))).get('Out of Scope') ??
      '';

    if (changedFiles.length > 0 && executionState && executionState.overall_status !== 'completed') {
      return verdictBase(
        'spec-conformance',
        'changes_requested',
        'Execution state is not completed for the current changed files.',
        [
          {
            severity: 'high',
            message: `execution-state.json reports ${executionState.overall_status ?? 'unknown'} instead of completed.`,
          },
        ],
      );
    }

    const planCompletionAudit = buildPlanCompletionAudit({
      plan,
      changedFiles,
      executionResults: await readExecutionResultArtifacts(topicDir),
    });

    const outOfScopeTouched = changedFiles.find((file) =>
      hasTokenOverlap(file, outOfScopeContent) && !isExplicitlyInScopeFile(file, plan),
    );
    if (outOfScopeTouched) {
      return verdictBase(
        'spec-conformance',
        'changes_requested',
        'Changed files touch an area that is explicitly out of scope for the reviewed plan.',
        [
          {
            severity: 'high',
            message: `Out-of-scope file changed: ${outOfScopeTouched}`,
          },
        ],
      );
    }

    return {
      ...verdictBase(
        'spec-conformance',
        'approved',
        `Spec and implementation plan are approved, fingerprint-matched, and free of unresolved placeholders. ${planCompletionAudit.summary}`,
      ),
      plan_completion_audit: planCompletionAudit,
    };
  }

  return verdictBase(
    'spec-conformance',
    'approved',
    'Spec and implementation plan are approved, fingerprint-matched, and free of unresolved placeholders.',
  );
}

async function runPrdConformanceLane(topicDir: string): Promise<ReviewVerdict> {
  const [spec, plan, brainstorm] = await Promise.all([
    readMaybe(join(topicDir, 'spec.md')),
    readMaybe(join(topicDir, 'implementation-plan.md')),
    readMaybe(join(topicDir, 'brainstorm.md')),
  ]);
  const requirements = extractPrdRequirements({ spec, plan, brainstorm });

  if (requirements.length === 0) {
    return verdictBase(
      'prd-conformance',
      'changes_requested',
      'No reviewable PRD or acceptance criteria were found.',
      [
        {
          severity: 'high',
          message: 'Record concrete acceptance criteria, goal, and constraints before review can pass.',
        },
      ],
    );
  }

  const workflow = await readWorkflowStateMaybe(topicDir);
  const worktreePath = workflow?.worktree?.worktree_path;
  if (!worktreePath) {
    return verdictBase(
      'prd-conformance',
      'changes_requested',
      'Worktree evidence is missing, so PRD conformance cannot be reviewed.',
      [
        {
          severity: 'high',
          message: 'Create or record the implementation worktree before PRD conformance review can pass.',
        },
      ],
    );
  }

  const changedFiles = listChangedFiles(worktreePath);
  if (changedFiles.length === 0) {
    return verdictBase(
      'prd-conformance',
      'changes_requested',
      'No changed files are present, so PRD conformance cannot be reviewed.',
      [
        {
          severity: 'high',
          message: 'Review requires implementation evidence for every acceptance criterion before commit can be allowed.',
        },
      ],
    );
  }

  const changedTestContents = await Promise.all(
    changedFiles
      .filter((file) => isTestFile(file))
      .map(async (file) => [file, await readMaybe(join(worktreePath, file))].join('\n')),
  );
  const executionResults = await readExecutionResultArtifacts(topicDir);
  const verificationEvidence = (workflow?.verification ?? [])
    .map((item) => [item.command, item.stdout ?? '', item.stderr ?? ''].join('\n'))
    .join('\n');
  const evidenceCorpus = [
    ...changedTestContents,
    ...executionResults,
    verificationEvidence,
  ].join('\n');

  const missingEvidence = requirements.filter((requirement) =>
    !hasMeaningfulEvidence(evidenceCorpus, requirement),
  );

  if (missingEvidence.length > 0) {
    return verdictBase(
      'prd-conformance',
      'changes_requested',
      'Some PRD requirements or acceptance criteria are not backed by execution or test evidence.',
      missingEvidence.map((requirement) => ({
        severity: 'high' as const,
        message: `Missing execution/test evidence for requirement: ${requirement}`,
      })),
    );
  }

  return {
    ...verdictBase(
      'prd-conformance',
      'approved',
      'Every extracted PRD requirement has matching execution or test evidence.',
    ),
    checked_requirement_count: requirements.length,
  };
}

async function runSideEffectRiskLane(topicDir: string): Promise<ReviewVerdict> {
  const [plan, spec, brainstorm] = await Promise.all([
    readMaybe(join(topicDir, 'implementation-plan.md')),
    readMaybe(join(topicDir, 'spec.md')),
    readMaybe(join(topicDir, 'brainstorm.md')),
  ]);
  const workflow = await readWorkflowStateMaybe(topicDir);
  const worktreePath = workflow?.worktree?.worktree_path;
  if (!worktreePath) {
    return verdictBase(
      'side-effect-risk',
      'changes_requested',
      'Worktree evidence is missing, so side-effect risk cannot be reviewed.',
      [
        {
          severity: 'high',
          message: 'Create or record the implementation worktree before side-effect review can pass.',
        },
      ],
    );
  }

  const changedFiles = listChangedFiles(worktreePath);
  if (changedFiles.length === 0) {
    return verdictBase(
      'side-effect-risk',
      'changes_requested',
      'No changed files are present, so side-effect risk cannot be reviewed.',
      [
        {
          severity: 'high',
          message: 'Review requires changed-file evidence before commit can be allowed.',
        },
      ],
    );
  }

  const plannedPathReferences = extractPlannedPathReferences(plan);
  const issues = plannedPathReferences.length > 0
    ? changedFiles
        .filter((file) => !plannedPathReferences.some((reference) => plannedPathMatchesFile(file, reference)))
        .map((file) => ({
          severity: 'high' as const,
          message: `Changed file is not listed in the reviewed likely files or allowed paths: ${file}`,
        }))
    : [];

  const riskEntries = changedFiles.flatMap((file) =>
    classifySideEffectRisk(file).map((risk) => ({ file, ...risk })),
  );
  const reviewText = [plan, spec, brainstorm].join('\n');
  if (riskEntries.length > 0 && !hasRiskMitigationLanguage(reviewText)) {
    issues.push({
      severity: 'high',
      message: `Side-effect-sensitive files changed without explicit risk, rollback, compatibility, deployment, or verification language: ${riskEntries.map((risk) => risk.file).join(', ')}`,
    });
  }

  for (const risk of riskEntries) {
    if (!hasPassingVerificationMatching(workflow, risk.verificationPattern)) {
      issues.push({
        severity: 'high',
        message: `Side-effect-sensitive change needs a passing verification command for ${risk.category}: ${risk.file}`,
      });
    }
  }

  if (issues.length > 0) {
    return verdictBase(
      'side-effect-risk',
      'changes_requested',
      'Changed files include unplanned or side-effect-sensitive surfaces that are not sufficiently proven safe.',
      issues,
    );
  }

  return {
    ...verdictBase(
      'side-effect-risk',
      'approved',
      riskEntries.length > 0
        ? 'Changed files stay inside the reviewed path set, and side-effect-sensitive surfaces have mitigation language plus passing verification evidence.'
        : 'Changed files stay inside the reviewed path set and no side-effect-sensitive surfaces were detected.',
    ),
    planned_path_count: plannedPathReferences.length,
    side_effect_sensitive_files: [...new Set(riskEntries.map((risk) => risk.file))],
  };
}

async function runTestAdequacyLane(topicDir: string): Promise<ReviewVerdict> {
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const workflow = await readWorkflowStateMaybe(topicDir);
  const worktreePath = workflow?.worktree?.worktree_path;

  if (worktreePath) {
    const successfulTestCommand = (workflow?.verification ?? []).some(
      (item) =>
        item.exit_code === 0 &&
        /\b(test|jest|vitest|pytest|unittest|go test|cargo test|phpunit|rspec)\b/i.test(item.command),
    );
    if (!successfulTestCommand) {
      return verdictBase(
        'test-adequacy',
        'changes_requested',
        'Verification evidence does not include a successful test command.',
        [
          {
            severity: 'high',
            message: 'Run a passing automated test command before review can approve test adequacy.',
          },
        ],
      );
    }

    const changedFiles = listChangedFiles(worktreePath);
    const changedCodeFiles = changedFiles.filter(needsChangedTestEvidence);
    const changedTestFiles = changedFiles.filter((file) => isTestFile(file));

    if (changedCodeFiles.length > 0 && changedTestFiles.length === 0) {
      return verdictBase(
        'test-adequacy',
        'changes_requested',
        'Code changed in the worktree, but no corresponding test file changes were found.',
        [
          {
            severity: 'high',
            message: 'Add or update tests for changed implementation files before review can pass.',
          },
        ],
      );
    }

    if (changedTestFiles.length > 0) {
      const [spec, brainstorm, resolvedContext] = await Promise.all([
        readMaybe(join(topicDir, 'spec.md')),
        readMaybe(join(topicDir, 'brainstorm.md')),
        readMaybe(join(topicDir, 'resolved-context.json')),
      ]);
      const contextLabels = (() => {
        try {
          const parsed = JSON.parse(resolvedContext) as { matches?: Array<{ label?: string }> };
          return (parsed.matches ?? []).map((item) => item.label).filter(Boolean).join('\n');
        } catch {
          return '';
        }
      })();
      const desiredCoverage = [spec, brainstorm, contextLabels].join('\n');
      const testContents = await Promise.all(
        changedTestFiles.map(async (file) => ({
          file,
          content: await readMaybe(join(worktreePath, file)),
        })),
      );
      const hasRelevantCoverage = testContents.some((test) =>
        hasTokenOverlap(test.content, desiredCoverage),
      );

      if (!hasRelevantCoverage) {
        return verdictBase(
          'test-adequacy',
          'changes_requested',
          'Changed tests do not clearly reflect the spec, brainstorm, or domain-policy language yet.',
          [
            {
              severity: 'medium',
              message: 'Make the changed tests reference the agreed outcome, constraints, or domain-policy terms more explicitly.',
            },
          ],
        );
      }

      const codeEvidence = await Promise.all(
        changedCodeFiles.map(async (file) => ({
          file,
          reference: [file, await readMaybe(join(worktreePath, file))].join('\n'),
        })),
      );
      const uncoveredCodeFiles = codeEvidence
        .filter((code) =>
          !testContents.some((test) =>
            hasTokenOverlap(test.content, desiredCoverage) &&
            countSharedReviewTokens([test.file, test.content].join('\n'), code.reference) > 0,
          ),
        )
        .map((code) => code.file);

      if (uncoveredCodeFiles.length > 0) {
        return verdictBase(
          'test-adequacy',
          'changes_requested',
          'Changed tests do not clearly map back to every changed implementation file.',
          uncoveredCodeFiles.map((file) => ({
            severity: 'high' as const,
            message: `No changed test evidence appears aligned with implementation file: ${file}`,
          })),
        );
      }
    }
  }

  const planSections = parseMarkdownSections(plan);
  if (
    !/\b(test|tdd)\b/i.test(plan) ||
    containsPlaceholder(plan) ||
    !readPlanSection(planSections, 'Verification Commands')
  ) {
    return verdictBase(
      'test-adequacy',
      'changes_requested',
      'Implementation plan does not yet provide reviewable test evidence expectations.',
      [
        {
          severity: 'medium',
          message: 'Implementation plan should explicitly reference tests or TDD expectations.',
        },
      ],
    );
  }

  return verdictBase(
    'test-adequacy',
    'approved',
    'Implementation plan explicitly references test or TDD expectations.',
  );
}

async function runEngineeringDisciplineLane(topicDir: string): Promise<ReviewVerdict> {
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const profile = await readProjectProfileForTopic(topicDir);
  const requiredTestStrategy = profile?.engineering_defaults.test_strategy ?? 'tdd';
  const requiredArchitecture = profile?.engineering_defaults.architecture ?? 'clean-boundaries';
  const hasTdd = strategyPattern(requiredTestStrategy).test(plan);
  const hasArchitecture = architecturePattern(requiredArchitecture).test(plan);
  const planSections = parseMarkdownSections(plan);
  const hasGuardrails = Boolean(readPlanSection(planSections, 'Anti-Rationalization Guardrails'));
  const issues: NonNullable<ReviewVerdict['issues']> = [];

  if (containsPlaceholder(plan) || !hasTdd || !hasArchitecture || !hasGuardrails) {
    issues.push({
      severity: 'medium',
      message: `Implementation plan should explicitly reference ${requiredTestStrategy} and ${requiredArchitecture}.`,
    });
  }

  const workflow = await readWorkflowStateMaybe(topicDir);
  const worktreePath = workflow?.worktree?.worktree_path;
  if (worktreePath) {
    const changedFiles = listChangedFiles(worktreePath).filter(shouldInspectEngineeringFile);
    issues.push(...(
      await Promise.all(
        changedFiles.map(async (file) =>
          inspectEngineeringFile(file, await readMaybe(join(worktreePath, file))),
        ),
      )
    ).flat());
  }

  if (issues.length > 0) {
    return verdictBase(
      'engineering-discipline',
      'changes_requested',
      'Engineering-discipline expectations or changed-code hygiene checks did not pass.',
      issues,
    );
  }

  return verdictBase(
    'engineering-discipline',
    'approved',
    'Implementation plan references the configured engineering-method guardrails, and changed code has no debug-only or unfinished artifacts.',
  );
}

async function runConversationTraceLane(topicDir: string): Promise<ReviewVerdict> {
  const request = await readMaybe(join(topicDir, 'request.md'));
  const summary = await readMaybe(join(topicDir, 'request-summary.md'));
  const spec = await readMaybe(join(topicDir, 'spec.md'));
  const brainstorm = await readMaybe(join(topicDir, 'brainstorm.md'));
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const workflow = await readWorkflowStateMaybe(topicDir);

  if (!request.trim() || !summary.trim() || !brainstorm.trim() || containsPlaceholder(spec)) {
    return verdictBase(
      'conversation-trace',
      'changes_requested',
      'Request artifacts exist, but the spec is not yet traceable enough to the original request.',
      [
        {
          severity: 'medium',
          message: 'A reviewable brainstorm + spec must exist before conversation trace can pass.',
        },
      ],
    );
  }

  const brainstormSections = parseMarkdownSections(brainstorm);
  const missingSpecSections = ['Clarified Outcome', 'Constraints', 'Out of Scope'].filter(
    (section) => {
      const content = brainstormSections.get(section);
      return content && !hasTokenOverlap(spec, content);
    },
  );
  const planSections = parseMarkdownSections(plan);
  const missingPlanSections = [
    {
      source: 'Verification Expectations',
      target:
        readPlanSection(planSections, 'Verification Commands', 'Acceptance Criteria'),
    },
    {
      source: 'Implementation Areas',
      target:
        readPlanSection(planSections, 'Likely Files Touched', 'Execution Tasks'),
    },
    {
      source: 'Long-running Work',
      target:
        readPlanSection(planSections, 'Optional Coordination Notes', 'Execution Lanes (Optional)'),
    },
  ]
    .filter(({ source, target }) => {
      const content = brainstormSections.get(source);
      return content && !hasTokenOverlap(target, content);
    })
    .map(({ source }) => source);

  if (missingSpecSections.length > 0 || missingPlanSections.length > 0) {
    return verdictBase(
      'conversation-trace',
      'changes_requested',
      'The spec or implementation plan does not yet reflect all of the clarified brainstorming details.',
      [
        ...missingSpecSections.map((section) => ({
          severity: 'medium' as const,
          message: `Spec is missing clarified brainstorming details from section: ${section}.`,
        })),
        ...missingPlanSections.map((section) => ({
          severity: 'medium' as const,
          message: `Implementation plan is missing clarified brainstorming details from section: ${section}.`,
        })),
      ],
    );
  }

  const worktreePath = workflow?.worktree?.worktree_path;
  if (worktreePath) {
    const changedFiles = listChangedFiles(worktreePath);
    if (changedFiles.length > 0) {
      const executionResults = await readExecutionResultArtifacts(topicDir);
      const mentionedFiles = extractMentionedFilesFromExecutionResults(executionResults);
      const unmentionedChangedFile = changedFiles.find((file) => !mentionedFiles.includes(file));

      if (unmentionedChangedFile) {
        return verdictBase(
          'conversation-trace',
          'changes_requested',
          'Execution results do not describe all of the changed files yet.',
          [
            {
              severity: 'medium',
              message: `Changed file is missing from execution result artifacts: ${unmentionedChangedFile}.`,
            },
          ],
        );
      }
    }
  }

  return verdictBase(
    'conversation-trace',
    'approved',
    'Request, summary, brainstorm, and spec artifacts are traceable to the original request.',
  );
}

export async function runReviewLanes({
  topicDir,
}: RunReviewLanesInput): Promise<ReviewVerdict[]> {
  const upstreamVerdicts = await Promise.all([
    runDomainPolicyLane(topicDir),
    runOnboardingComplianceLane(topicDir),
    runRepositoryReviewGateLane(topicDir),
    runPlanningReadinessLane(topicDir),
    runSpecConformanceLane(topicDir),
    runPrdConformanceLane(topicDir),
    runSideEffectRiskLane(topicDir),
    runTestAdequacyLane(topicDir),
    runEngineeringDisciplineLane(topicDir),
    runConversationTraceLane(topicDir),
  ]);
  const verdicts = [
    ...upstreamVerdicts,
    await runIndependentReviewGate({
      topicDir,
      upstreamVerdicts,
    }),
  ];

  await Promise.all(
    verdicts.map((verdict) =>
      writeFile(
        join(topicDir, 'review', `${verdict.lane}.json`),
        `${JSON.stringify(verdict, null, 2)}\n`,
        'utf8',
      ),
    ),
  );

  return verdicts;
}
