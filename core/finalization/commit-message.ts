export interface LoreCommitMessageInput {
  intent: string;
  body: string;
  constraint: string;
  confidence: 'low' | 'medium' | 'high';
  scopeRisk: 'narrow' | 'moderate' | 'broad';
  directive?: string;
  tested: string;
  notTested: string;
  rejected?: string;
  related?: string;
  reversibility?: 'clean' | 'messy' | 'irreversible';
}

export interface LoreCommitValidationResult {
  valid: boolean;
  issues: string[];
}

export interface TopicLoreCommitMessageInput {
  request: string;
  requestSummary?: string;
  topicSlug?: string;
  verificationCommands?: string[];
}

const REQUIRED_TRAILERS = [
  'Constraint:',
  'Confidence:',
  'Scope-risk:',
  'Tested:',
  'Not-tested:',
] as const;

export function validateLoreCommitMessage(
  message: string,
): LoreCommitValidationResult {
  const issues: string[] = [];
  const trimmed = String(message || '').trim();
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (trimmed === '') {
    issues.push('Commit message is empty.');
  }
  if (lines.length === 0 || lines[0]!.trim() === '') {
    issues.push('Intent line is required.');
  }

  for (const trailer of REQUIRED_TRAILERS) {
    if (!new RegExp(`^${trailer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+.+$`, 'm').test(trimmed)) {
      issues.push(`Missing required lore trailer: ${trailer}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function buildLoreCommitMessage({
  intent,
  body,
  constraint,
  confidence,
  scopeRisk,
  directive,
  tested,
  notTested,
  rejected,
  related,
  reversibility,
}: LoreCommitMessageInput): string {
  const lines = [intent.trim(), '', body.trim(), '', `Constraint: ${constraint}`];

  if (rejected) lines.push(`Rejected: ${rejected}`);
  lines.push(`Confidence: ${confidence}`);
  lines.push(`Scope-risk: ${scopeRisk}`);
  if (reversibility) lines.push(`Reversibility: ${reversibility}`);
  if (directive) lines.push(`Directive: ${directive}`);
  lines.push(`Tested: ${tested}`);
  lines.push(`Not-tested: ${notTested}`);
  if (related) lines.push(`Related: ${related}`);

  return `${lines.join('\n').trimEnd()}\n`;
}

function normalizeOneLine(value: string | undefined): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function buildTopicLoreCommitMessage({
  request,
  requestSummary,
  topicSlug,
  verificationCommands = [],
}: TopicLoreCommitMessageInput): string {
  const normalizedSummary = normalizeOneLine(requestSummary) || normalizeOneLine(request);
  const normalizedRequest = normalizeOneLine(request) || normalizedSummary;
  const intentSource = normalizedSummary || 'reviewed request update';
  const tested = ['Shift AX review lanes', ...verificationCommands]
    .map((command) => normalizeOneLine(command))
    .filter(Boolean)
    .join('; ');

  return buildLoreCommitMessage({
    intent: truncate(`Deliver reviewed change: ${intentSource}`, 72),
    body: [
      `This commit captures the reviewed Shift AX work for "${normalizedRequest || intentSource}".`,
      'The request passed context resolution, human plan review, and review gates before local finalization.',
    ].join(' '),
    constraint: 'v1 finalization stops at a meaningful local git commit',
    confidence: 'high',
    scopeRisk: 'moderate',
    directive: 'Re-run plan-review, escalation, and review gates before changing finalization semantics',
    tested: tested || 'Shift AX review lanes',
    notTested: 'GitHub push or PR automation beyond the v1 local-commit boundary',
    ...(topicSlug ? { related: `topic:${topicSlug}` } : {}),
  });
}
