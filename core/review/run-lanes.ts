import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ReviewVerdict } from './aggregate-reviews.js';
import { readProjectProfile } from '../policies/project-profile.js';
import { readPlanReviewArtifact, verifyApprovedPlanFingerprint } from '../planning/plan-review.js';
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
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !['that', 'this', 'with', 'from', 'into', 'when', 'then', 'keep'].includes(token));
}

function parseMarkdownSections(content: string): Map<string, string> {
  const lines = String(content || '').split(/\r?\n/);
  const sections = new Map<string, string>();
  let current: string | null = null;
  const buffer: string[] = [];

  const flush = () => {
    if (current) {
      sections.set(current, buffer.join('\n').trim());
      buffer.length = 0;
    }
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      flush();
      current = match[1]!.trim();
      continue;
    }
    if (current) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function hasTokenOverlap(content: string, reference: string): boolean {
  const haystack = String(content || '').toLowerCase();
  return tokenizeReviewWords(reference).some((token) => haystack.includes(token));
}

async function readWorkflowStateMaybe(topicDir: string): Promise<{
  verification?: Array<{ command: string; exit_code: number }>;
  worktree?: { worktree_path?: string };
} | null> {
  const raw = await readMaybe(join(topicDir, 'workflow-state.json'));
  if (!raw) return null;
  return JSON.parse(raw) as {
    verification?: Array<{ command: string; exit_code: number }>;
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
  return /(^|\/)(tests?|__tests__)\//i.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path);
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
    return readProjectProfile(topicDir);
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

    const outOfScopeTouched = changedFiles.find((file) => hasTokenOverlap(file, outOfScopeContent));
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
  }

  return verdictBase(
    'spec-conformance',
    'approved',
    'Spec and implementation plan are approved, fingerprint-matched, and free of unresolved placeholders.',
  );
}

async function runTestAdequacyLane(topicDir: string): Promise<ReviewVerdict> {
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));
  const workflow = await readWorkflowStateMaybe(topicDir);
  const worktreePath = workflow?.worktree?.worktree_path;

  if (worktreePath) {
    const successfulTestCommand = (workflow?.verification ?? []).some(
      (item) => item.exit_code === 0 && /\b(test|jest|vitest|pytest|go test|cargo test|phpunit|rspec)\b/i.test(item.command),
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
    const changedCodeFiles = changedFiles.filter((file) => !isTestFile(file));
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
        changedTestFiles.map((file) => readMaybe(join(worktreePath, file))),
      );
      const hasRelevantCoverage = testContents.some((content) =>
        hasTokenOverlap(content, desiredCoverage),
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
    }
  }

  if (!/\b(test|tdd)\b/i.test(plan) || containsPlaceholder(plan)) {
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

  if (containsPlaceholder(plan) || !hasTdd || !hasArchitecture) {
    return verdictBase(
      'engineering-discipline',
      'changes_requested',
      'Engineering-discipline expectations are not yet explicit enough.',
      [
        {
          severity: 'medium',
          message: `Implementation plan should explicitly reference ${requiredTestStrategy} and ${requiredArchitecture}.`,
        },
      ],
    );
  }

  return verdictBase(
    'engineering-discipline',
    'approved',
    'Implementation plan references the configured engineering-method guardrails.',
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
  const missingPlanSections = ['Verification Expectations', 'Implementation Areas', 'Long-running Work'].filter(
    (section) => {
      const content = brainstormSections.get(section);
      return content && !hasTokenOverlap(plan, content);
    },
  );

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
  const verdicts = await Promise.all([
    runDomainPolicyLane(topicDir),
    runSpecConformanceLane(topicDir),
    runTestAdequacyLane(topicDir),
    runEngineeringDisciplineLane(topicDir),
    runConversationTraceLane(topicDir),
  ]);

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
