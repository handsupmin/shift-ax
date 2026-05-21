import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ShiftAxRepositoryReviewGate } from '../policies/project-profile.js';

const execFileAsync = promisify(execFile);

interface MergeEvidence {
  sha: string;
  subject: string;
  body: string;
  files: string[];
}

export interface InferRepositoryReviewGateInput {
  repository: string;
  repositoryPath?: string;
  workflow?: string;
  hiddenConventions?: string[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024 * 8,
  });
  return String(stdout || '').trim();
}

function unique(values: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

async function collectMergedPrEvidence(repositoryPath?: string): Promise<MergeEvidence[]> {
  if (!repositoryPath || !(await pathExists(repositoryPath))) return [];

  try {
    await runGit(repositoryPath, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return [];
  }

  const mergeLines = await runGit(repositoryPath, [
    'log',
    '--merges',
    '--first-parent',
    '--max-count=24',
    '--pretty=format:%H%x09%s',
  ]).catch(() => '');

  const merges = mergeLines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subjectParts] = line.split('\t');
      return { sha: sha || '', subject: subjectParts.join('\t') || sha || '' };
    })
    .filter((merge) => merge.sha);

  const evidence: MergeEvidence[] = [];
  for (const merge of merges.slice(0, 12)) {
    const show = await runGit(repositoryPath, ['show', '--name-only', '--format=%B', '--no-renames', '-n', '1', merge.sha])
      .catch(() => '');
    const [messagePart = '', filePart = ''] = show.split(/\n\n(?=[^\n]+\.[a-z0-9]+|src\/|app\/|packages\/|db\/|prisma\/)/i);
    const files = unique(
      filePart
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[\w./@+-]+$/.test(line)),
      20,
    );
    evidence.push({
      sha: merge.sha,
      subject: merge.subject,
      body: messagePart || merge.subject,
      files,
    });
  }

  return evidence;
}

function evidenceText(evidence: MergeEvidence[]): string {
  return evidence
    .map((item) => `${item.subject}\n${item.body}\n${item.files.join('\n')}`)
    .join('\n')
    .toLowerCase();
}

function subjectsMatching(evidence: MergeEvidence[], pattern: RegExp): string[] {
  return unique(
    evidence
      .filter((item) => pattern.test(`${item.subject}\n${item.body}\n${item.files.join('\n')}`.toLowerCase()))
      .map((item) => `${item.subject} (${item.sha.slice(0, 7)})`),
    4,
  );
}

function buildArchitectureChecks({
  repository,
  workflow,
  evidence,
}: {
  repository: string;
  workflow: string;
  evidence: MergeEvidence[];
}): string[] {
  const matches = subjectsMatching(
    evidence,
    /controller|service|module|domain|usecase|repository|adapter|dto|schema|model|prisma|migration|worker|queue|refactor|architecture/,
  );
  return unique([
    `Confirm ${repository} layer boundaries and data flow before approving behavior changes.`,
    /controller|service|module|worker|queue|prisma|migration|schema/i.test(workflow)
      ? `Apply the recorded workflow's architecture order: ${workflow.slice(0, 220)}`
      : '',
    ...matches.map((match) => `Compare architecture impact with merged PR pattern: ${match}.`),
  ]);
}

function buildWorkingProcessChecks({
  workflow,
  evidence,
}: {
  workflow: string;
  evidence: MergeEvidence[];
}): string[] {
  const matches = subjectsMatching(evidence, /test|spec|lint|type|build|migration|deploy|release|rollback|hotfix|qa|review/);
  return unique([
    `Follow the recorded working process before implementation and again before commit: ${workflow.slice(0, 240)}`,
    'Require explicit verification evidence for the touched repo before the commit can be created.',
    ...matches.map((match) => `Preserve process expectation observed in merged PR: ${match}.`),
  ]);
}

function buildConventionChecks({
  hiddenConventions,
  evidence,
}: {
  hiddenConventions: string[];
  evidence: MergeEvidence[];
}): string[] {
  const matches = subjectsMatching(evidence, /dto|lint|format|naming|generated|prisma|schema|controller|service|module|test|spec/);
  return unique([
    ...hiddenConventions.map((item) => `Enforce onboarding convention: ${item}`),
    'Use repo-native naming, generated-file ownership, test placement, and layer naming conventions.',
    ...matches.map((match) => `Check convention consistency against merged PR pattern: ${match}.`),
  ]);
}

function buildSideEffectChecks({
  evidence,
}: {
  evidence: MergeEvidence[];
}): string[] {
  const matches = subjectsMatching(
    evidence,
    /migration|schema|queue|worker|cron|redis|sqs|bullmq|cache|auth|permission|payment|notification|s3|external|delete|rollback|idempot/,
  );
  return unique([
    'Identify data, queue/worker, cache, auth/permission, external API, destructive operation, deployment, rollback, and idempotency side effects.',
    'Require tests or explicit verification for each risky surface touched by the implementation.',
    ...matches.map((match) => `Review side-effect handling against merged PR pattern: ${match}.`),
  ]);
}

export async function inferRepositoryReviewGate({
  repository,
  repositoryPath,
  workflow = '',
  hiddenConventions = [],
}: InferRepositoryReviewGateInput): Promise<ShiftAxRepositoryReviewGate> {
  const evidence = await collectMergedPrEvidence(repositoryPath);
  const evidenceSummary =
    evidence.length > 0
      ? evidence.map((item) => `${item.subject} (${item.sha.slice(0, 7)})`)
      : [
          repositoryPath
            ? `No merged PR history was available from ${repositoryPath}; fallback gate generated from onboarding workflow.`
            : 'No repository path was recorded; fallback gate generated from onboarding workflow.',
        ];
  const text = evidenceText(evidence);
  const sideEffectFallback =
    /migration|schema|queue|worker|cron|redis|sqs|bullmq|cache|auth|permission|payment|notification|s3|external|delete|rollback|idempot/.test(text) ||
    /migration|schema|queue|worker|cron|redis|sqs|bullmq|cache|auth|permission|payment|notification|s3|external|delete|rollback|idempot/i.test(workflow);

  return {
    repository,
    ...(repositoryPath ? { repository_path: repositoryPath } : {}),
    architecture: buildArchitectureChecks({ repository, workflow, evidence }),
    working_process: buildWorkingProcessChecks({ workflow, evidence }),
    conventions: buildConventionChecks({ hiddenConventions, evidence }),
    side_effects: sideEffectFallback
      ? buildSideEffectChecks({ evidence })
      : unique([
          'Explicitly prove the change has no data, queue/worker, cache, auth/permission, external API, destructive operation, deployment, rollback, or idempotency side effects.',
          'If a side-effect surface is discovered while implementing, add focused tests or verification before commit.',
        ]),
    evidence: evidenceSummary.slice(0, 12),
  };
}
