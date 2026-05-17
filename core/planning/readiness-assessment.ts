import { readFile, writeFile } from 'node:fs/promises';

import { parseMarkdownSections, readPlanSection } from './implementation-plan.js';
import { topicArtifactPath } from '../topics/topic-artifacts.js';

export interface ShiftAxPlanningReadinessDimension {
  name: 'goal' | 'constraints' | 'success_criteria' | 'context' | 'scope';
  weight: number;
  clarity: number;
  evidence: string[];
  missing: string[];
}

export interface ShiftAxPlanningReadinessAssessment {
  version: 1;
  generated_at: string;
  ambiguity_threshold: number;
  ambiguity_score: number;
  status: 'ready' | 'needs_clarification';
  dimensions: ShiftAxPlanningReadinessDimension[];
  blockers: string[];
  recommendations: string[];
}

const DEFAULT_THRESHOLD = 0.2;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function lines(value: string): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#+\s+/.test(line));
}

function tokenCount(value: string): number {
  return String(value || '')
    .split(/[^A-Za-z0-9가-힣_./:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .length;
}

function hasSpecificSignals(value: string): boolean {
  return /(^|\s)(src|core|apps?|packages?|tests?|docs?|prisma|migration|controller|service|dto|api|ui|cli)\//i.test(value) ||
    /[A-Za-z0-9_-]+\.(ts|tsx|js|jsx|json|md|py|sql|prisma|yaml|yml)\b/i.test(value) ||
    /\b(no|never|must|exact|specific|verify|test|build|lint|type-check|schema|migration|TDD)\b/i.test(value) ||
    /금지|반드시|검증|테스트|스키마|마이그레이션|정확히/.test(value);
}

function scoreEvidence(value: string, minimumLines = 1): number {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 0;

  const count = tokenCount(trimmed);
  const lineCount = lines(trimmed).length;
  let score = 0.35;
  if (count >= 6) score += 0.2;
  if (count >= 14) score += 0.15;
  if (lineCount >= minimumLines) score += 0.1;
  if (lineCount >= minimumLines + 1) score += 0.1;
  if (hasSpecificSignals(trimmed)) score += 0.15;
  return clampScore(score);
}

function compactEvidence(...values: string[]): string[] {
  return values
    .flatMap((value) => lines(value))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

export function matchedContextLabelsFromResolvedContext(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { matches?: Array<{ label?: string }> };
    return (parsed.matches ?? [])
      .map((match) => match.label)
      .filter((label): label is string => Boolean(label));
  } catch {
    return [];
  }
}

function buildDimension({
  name,
  weight,
  clarity,
  evidence,
  missing,
}: ShiftAxPlanningReadinessDimension): ShiftAxPlanningReadinessDimension {
  return {
    name,
    weight,
    clarity: clampScore(clarity),
    evidence,
    missing,
  };
}

export function assessPlanningReadiness({
  request,
  matchedContextLabels,
  brainstormContent,
  specContent,
  implementationPlanContent,
  ambiguityThreshold = DEFAULT_THRESHOLD,
  now = new Date(),
}: {
  request: string;
  matchedContextLabels: string[];
  brainstormContent: string;
  specContent: string;
  implementationPlanContent: string;
  ambiguityThreshold?: number;
  now?: Date;
}): ShiftAxPlanningReadinessAssessment {
  const brainstorm = parseMarkdownSections(brainstormContent);
  const spec = parseMarkdownSections(specContent);
  const plan = parseMarkdownSections(implementationPlanContent);

  const goalText = [
    readPlanSection(spec, 'Goal'),
    readPlanSection(brainstorm, 'Clarified Outcome'),
    readPlanSection(plan, 'Acceptance Criteria'),
    request,
  ].join('\n');
  const constraintText = [
    readPlanSection(spec, 'Constraints'),
    readPlanSection(brainstorm, 'Constraints'),
    readPlanSection(spec, 'Out of Scope'),
    readPlanSection(brainstorm, 'Out of Scope'),
    readPlanSection(plan, 'Dependencies'),
    readPlanSection(plan, 'Checkpoints'),
    readPlanSection(plan, 'Anti-Rationalization Guardrails'),
  ].join('\n');
  const successText = [
    readPlanSection(plan, 'Acceptance Criteria'),
    readPlanSection(plan, 'Verification Commands'),
    readPlanSection(spec, 'Verification Expectations'),
    readPlanSection(brainstorm, 'Verification Expectations'),
  ].join('\n');
  const contextText = [
    matchedContextLabels.join('\n'),
    readPlanSection(spec, 'Relevant Context'),
    readPlanSection(brainstorm, 'Relevant Context'),
    readPlanSection(plan, 'Dependencies'),
  ].join('\n');
  const scopeText = [
    readPlanSection(plan, 'Likely Files Touched'),
    readPlanSection(plan, 'Execution Tasks'),
    readPlanSection(spec, 'Out of Scope'),
    readPlanSection(brainstorm, 'Out of Scope'),
  ].join('\n');

  const dimensions = [
    buildDimension({
      name: 'goal',
      weight: 0.3,
      clarity: scoreEvidence(goalText),
      evidence: compactEvidence(readPlanSection(spec, 'Goal'), readPlanSection(plan, 'Acceptance Criteria')),
      missing: scoreEvidence(goalText) >= 0.8 ? [] : ['Clarify the exact outcome and acceptance criteria.'],
    }),
    buildDimension({
      name: 'constraints',
      weight: 0.2,
      clarity: scoreEvidence(constraintText),
      evidence: compactEvidence(readPlanSection(spec, 'Constraints'), readPlanSection(spec, 'Out of Scope')),
      missing: scoreEvidence(constraintText) >= 0.8 ? [] : ['Record constraints and explicit out-of-scope boundaries.'],
    }),
    buildDimension({
      name: 'success_criteria',
      weight: 0.2,
      clarity: scoreEvidence(successText),
      evidence: compactEvidence(readPlanSection(plan, 'Verification Commands'), readPlanSection(plan, 'Acceptance Criteria')),
      missing: scoreEvidence(successText) >= 0.8 ? [] : ['Define measurable verification commands and success criteria.'],
    }),
    buildDimension({
      name: 'context',
      weight: 0.15,
      clarity: matchedContextLabels.length > 0 ? Math.max(0.8, scoreEvidence(contextText)) : scoreEvidence(contextText),
      evidence: compactEvidence(matchedContextLabels.join('\n'), readPlanSection(plan, 'Dependencies')),
      missing: matchedContextLabels.length > 0 || scoreEvidence(contextText) >= 0.8
        ? []
        : ['Resolve at least one relevant global context document or record why no match applies.'],
    }),
    buildDimension({
      name: 'scope',
      weight: 0.15,
      clarity: scoreEvidence(scopeText),
      evidence: compactEvidence(readPlanSection(plan, 'Likely Files Touched'), readPlanSection(plan, 'Execution Tasks')),
      missing: scoreEvidence(scopeText) >= 0.8 ? [] : ['Name likely files or boundaries and split implementation tasks.'],
    }),
  ];

  const weightedClarity = dimensions.reduce(
    (sum, dimension) => sum + dimension.clarity * dimension.weight,
    0,
  );
  const ambiguityScore = clampScore(1 - weightedClarity);
  const blockers = dimensions
    .filter((dimension) => dimension.clarity < 0.8)
    .flatMap((dimension) => dimension.missing);

  return {
    version: 1,
    generated_at: now.toISOString(),
    ambiguity_threshold: ambiguityThreshold,
    ambiguity_score: ambiguityScore,
    status: ambiguityScore <= ambiguityThreshold && blockers.length === 0 ? 'ready' : 'needs_clarification',
    dimensions,
    blockers,
    recommendations: blockers.length > 0
      ? blockers
      : ['Planning artifacts are clear enough for implementation after plan review approval.'],
  };
}

export function renderPlanningReadinessMarkdown(
  assessment: ShiftAxPlanningReadinessAssessment,
): string {
  return [
    '## Ambiguity Assessment',
    '',
    `- Status: ${assessment.status}`,
    `- Ambiguity Score: ${assessment.ambiguity_score.toFixed(3)}`,
    `- Threshold: ${assessment.ambiguity_threshold.toFixed(3)}`,
    '',
    '## Readiness Dimensions',
    '',
    ...assessment.dimensions.map(
      (dimension) =>
        `- ${dimension.name}: clarity=${dimension.clarity.toFixed(3)}, weight=${dimension.weight.toFixed(2)}`,
    ),
    '',
    '## Readiness Blockers',
    '',
    ...(assessment.blockers.length > 0
      ? assessment.blockers.map((blocker) => `- ${blocker}`)
      : ['- None.']),
  ].join('\n');
}

export async function assessTopicPlanningReadiness({
  topicDir,
  ambiguityThreshold,
  now = new Date(),
}: {
  topicDir: string;
  ambiguityThreshold?: number;
  now?: Date;
}): Promise<ShiftAxPlanningReadinessAssessment> {
  const [request, resolvedContext, brainstorm, spec, plan] = await Promise.all([
    readMaybe(topicArtifactPath(topicDir, 'request')),
    readMaybe(topicArtifactPath(topicDir, 'resolved_context')),
    readMaybe(topicArtifactPath(topicDir, 'brainstorm')),
    readMaybe(topicArtifactPath(topicDir, 'spec')),
    readMaybe(topicArtifactPath(topicDir, 'implementation_plan')),
  ]);
  const assessment = assessPlanningReadiness({
    request,
    matchedContextLabels: matchedContextLabelsFromResolvedContext(resolvedContext),
    brainstormContent: brainstorm,
    specContent: spec,
    implementationPlanContent: plan,
    ...(ambiguityThreshold === undefined ? {} : { ambiguityThreshold }),
    now,
  });

  await writeFile(
    topicArtifactPath(topicDir, 'readiness_assessment'),
    `${JSON.stringify(assessment, null, 2)}\n`,
    'utf8',
  );

  return assessment;
}
