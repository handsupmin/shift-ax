export const SHIFT_AX_REQUIRED_IMPLEMENTATION_PLAN_SECTIONS = [
  'Acceptance Criteria',
  'Verification Commands',
  'Dependencies',
  'Likely Files Touched',
  'Checkpoints',
  'Execution Tasks',
] as const;

export type ShiftAxParallelizationMode =
  | 'safe'
  | 'sequential'
  | 'coordination_required';

export interface ShiftAxExecutionLaneMetadata {
  owner?: string;
  allowed_paths?: string[];
  parallelization_mode?: ShiftAxParallelizationMode;
  conflict_flag?: string;
  contract_artifact?: string;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parseMarkdownSections(content: string): Map<string, string> {
  const lines = String(content || '').split(/\r?\n/);
  const sections = new Map<string, string>();
  let current: string | null = null;
  const buffer: string[] = [];

  const flush = () => {
    if (!current) return;
    sections.set(current, buffer.join('\n').trim());
    buffer.length = 0;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = heading[1]!.trim();
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

export function extractMarkdownBullets(content: string | undefined): string[] {
  return String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[-*]\s+|^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

export function listMissingImplementationPlanSections(plan: string): string[] {
  const sections = parseMarkdownSections(plan);
  return SHIFT_AX_REQUIRED_IMPLEMENTATION_PLAN_SECTIONS.filter(
    (section) => !sections.get(section)?.trim(),
  );
}

export function extractExecutionTaskLines(plan: string): string[] {
  const sections = parseMarkdownSections(plan);
  const preferred =
    sections.get('Execution Tasks') ?? sections.get('Delivery Tasks') ?? '';
  const taskLines = extractMarkdownBullets(preferred);
  if (taskLines.length > 0) {
    return taskLines;
  }

  return String(plan || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => /^[-*]\s+|^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

export function readPlanSection(
  sections: Map<string, string>,
  ...names: string[]
): string {
  for (const name of names) {
    const value = sections.get(name);
    if (value?.trim()) return value;
  }
  return '';
}

function parseCsv(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseExecutionLaneMetadata(
  plan: string,
): Map<string, ShiftAxExecutionLaneMetadata> {
  const sections = parseMarkdownSections(plan);
  const raw = readPlanSection(sections, 'Execution Lanes (Optional)', 'Execution Lanes');
  const lines = String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line));
  const metadata = new Map<string, ShiftAxExecutionLaneMetadata>();

  for (const line of lines) {
    const body = line.replace(/^[-*]\s+/, '').trim();
    if (!body || /^none recorded\.?$/i.test(body)) continue;

    const parts = body
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    const pairs = new Map<string, string>();
    for (const part of parts) {
      const divider = part.indexOf(':');
      if (divider === -1) continue;
      const key = normalizeKey(part.slice(0, divider));
      const value = part.slice(divider + 1).trim();
      if (key) pairs.set(key, value);
    }

    const appliesTo = [
      ...parseCsv(pairs.get('task')),
      ...parseCsv(pairs.get('tasks')),
      ...parseCsv(pairs.get('applies_to')),
    ];
    if (appliesTo.length === 0) continue;

    const mode = pairs.get('parallelization_mode') ?? pairs.get('mode');
    const parsedMode =
      mode === 'safe' || mode === 'sequential' || mode === 'coordination_required'
        ? mode
        : undefined;

    const value: ShiftAxExecutionLaneMetadata = {
      ...(pairs.get('owner') ? { owner: pairs.get('owner') } : {}),
      ...(parseCsv(pairs.get('allowed_paths')).length > 0
        ? { allowed_paths: parseCsv(pairs.get('allowed_paths')) }
        : {}),
      ...(parsedMode ? { parallelization_mode: parsedMode } : {}),
      ...(pairs.get('conflict_flag') || pairs.get('conflict')
        ? { conflict_flag: pairs.get('conflict_flag') ?? pairs.get('conflict') }
        : {}),
      ...(pairs.get('contract_artifact')
        ? { contract_artifact: pairs.get('contract_artifact') }
        : {}),
    };

    for (const taskId of appliesTo) {
      metadata.set(taskId, value);
    }
  }

  return metadata;
}
