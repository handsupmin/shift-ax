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
  return /\b(TBD|Pending\.)\b/i.test(content);
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

  return verdictBase(
    'spec-conformance',
    'approved',
    'Spec and implementation plan are approved, fingerprint-matched, and free of unresolved placeholders.',
  );
}

async function runTestAdequacyLane(topicDir: string): Promise<ReviewVerdict> {
  const plan = await readMaybe(join(topicDir, 'implementation-plan.md'));

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
