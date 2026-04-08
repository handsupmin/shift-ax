import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  [key: string]: unknown;
}

export interface ReviewVerdict {
  version: 1;
  lane: string;
  status: 'approved' | 'changes_requested' | 'blocked';
  checked_at: string;
  summary: string;
  issues?: ReviewIssue[];
  [key: string]: unknown;
}

export interface AggregateReviewsInput {
  topicDir: string;
  requiredLanes?: string[];
}

export interface AggregateReviewsResult {
  version: 1;
  overall_status: 'approved' | 'changes_requested' | 'blocked';
  commit_allowed: boolean;
  next_stage: 'finalization' | 'implementation';
  required_lanes: string[];
  approved_lanes: string[];
  changes_requested_lanes: string[];
  blocked_lanes: string[];
  missing_lanes: string[];
  verdicts: ReviewVerdict[];
}

export const REQUIRED_REVIEW_LANES = [
  'domain-policy',
  'spec-conformance',
  'test-adequacy',
  'engineering-discipline',
  'conversation-trace',
] as const;

async function readVerdictFile(path: string): Promise<ReviewVerdict> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as ReviewVerdict;
}

export async function aggregateReviewVerdicts({
  topicDir,
  requiredLanes = [...REQUIRED_REVIEW_LANES],
}: AggregateReviewsInput): Promise<AggregateReviewsResult> {
  if (!topicDir) throw new Error('topicDir is required');

  const reviewDir = join(topicDir, 'review');
  let files: string[] = [];
  try {
    files = (await readdir(reviewDir))
      .filter((entry) => entry.endsWith('.json'))
      .sort();
  } catch {
    files = [];
  }

  const verdicts: ReviewVerdict[] = [];
  for (const file of files) {
    try {
      const verdict = await readVerdictFile(join(reviewDir, file));
      verdicts.push(verdict);
    } catch {
      // Ignore malformed verdicts in aggregation.
    }
  }

  const byLane = new Map<string, ReviewVerdict>();
  for (const verdict of verdicts) {
    if (!verdict?.lane) continue;
    byLane.set(verdict.lane, verdict);
  }

  const approvedLanes: string[] = [];
  const changesRequestedLanes: string[] = [];
  const blockedLanes: string[] = [];
  const missingLanes: string[] = [];

  for (const lane of requiredLanes) {
    const verdict = byLane.get(lane);
    if (!verdict) {
      missingLanes.push(lane);
      continue;
    }
    if (verdict.status === 'approved') approvedLanes.push(lane);
    else if (verdict.status === 'changes_requested') {
      changesRequestedLanes.push(lane);
    } else {
      blockedLanes.push(lane);
    }
  }

  let overallStatus: AggregateReviewsResult['overall_status'] = 'approved';
  if (missingLanes.length > 0 || blockedLanes.length > 0) {
    overallStatus = 'blocked';
  } else if (changesRequestedLanes.length > 0) {
    overallStatus = 'changes_requested';
  }

  const commitAllowed = overallStatus === 'approved';
  const nextStage = commitAllowed ? 'finalization' : 'implementation';

  return {
    version: 1,
    overall_status: overallStatus,
    commit_allowed: commitAllowed,
    next_stage: nextStage,
    required_lanes: [...requiredLanes],
    approved_lanes: approvedLanes,
    changes_requested_lanes: changesRequestedLanes,
    blocked_lanes: blockedLanes,
    missing_lanes: missingLanes,
    verdicts: requiredLanes
      .map((lane) => byLane.get(lane))
      .filter((verdict): verdict is ReviewVerdict => Boolean(verdict)),
  };
}

export function renderReviewSummaryMarkdown(
  result: AggregateReviewsResult,
): string {
  const lines = [
    '# Review Summary',
    '',
    `- Overall Status: ${result.overall_status}`,
    `- Commit Allowed: ${result.commit_allowed ? 'yes' : 'no'}`,
    `- Next Stage: ${result.next_stage}`,
    '',
    '## Lane Status',
    '',
    `- Approved: ${result.approved_lanes.join(', ') || '(none)'}`,
    `- Changes Requested: ${result.changes_requested_lanes.join(', ') || '(none)'}`,
    `- Blocked: ${result.blocked_lanes.join(', ') || '(none)'}`,
    `- Missing Lanes: ${result.missing_lanes.join(', ') || '(none)'}`,
    '',
    '## Lane Summaries',
    '',
  ];

  if (result.verdicts.length === 0) {
    lines.push('- No lane verdicts were recorded.');
  } else {
    for (const verdict of result.verdicts) {
      lines.push(`### ${verdict.lane}`);
      lines.push(`- Status: ${verdict.status}`);
      lines.push(`- Summary: ${verdict.summary}`);
      if (verdict.issues && verdict.issues.length > 0) {
        lines.push('- Issues:');
        for (const issue of verdict.issues) {
          lines.push(`  - [${issue.severity}] ${issue.message}`);
        }
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export async function writeAggregateReviewArtifacts(
  topicDir: string,
  result: AggregateReviewsResult,
): Promise<void> {
  const reviewDir = join(topicDir, 'review');
  await Promise.all([
    writeFile(
      join(reviewDir, 'aggregate.json'),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    ),
    writeFile(join(reviewDir, 'summary.md'), renderReviewSummaryMarkdown(result), 'utf8'),
  ]);
}
