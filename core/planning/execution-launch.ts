import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { topicArtifactPath } from '../topics/topic-artifacts.js';

export interface ShiftAxExecutionHandoffTask {
  id: string;
  source_text: string;
  execution_mode: 'subagent' | 'tmux';
  reason: string;
}

export interface ShiftAxExecutionHandoffDocument {
  version: 1;
  generated_at: string;
  topic_slug: string;
  default_short_execution: string;
  default_long_execution: string;
  tasks: ShiftAxExecutionHandoffTask[];
}

export interface ShiftAxExecutionPromptArtifact {
  task: ShiftAxExecutionHandoffTask;
  worktreePath: string;
  promptPath: string;
  outputPath: string;
}

interface ResolvedContextSummary {
  matches?: Array<{ label?: string; path?: string }>;
}

async function readArtifact(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

async function assertResolvedContextReady(topicDir: string): Promise<void> {
  const raw = await readArtifact(topicArtifactPath(topicDir, 'resolved_context')).catch(() => '');
  if (!raw) {
    throw new Error('resolved context artifact is missing');
  }

  const parsed = JSON.parse(raw) as { unresolved_paths?: string[] };
  if ((parsed.unresolved_paths ?? []).length > 0) {
    throw new Error('resolved context still has unresolved base-context paths');
  }
}

export async function readExecutionHandoff(
  topicDir: string,
): Promise<ShiftAxExecutionHandoffDocument> {
  const raw = await readArtifact(topicArtifactPath(topicDir, 'execution_handoff'));
  return JSON.parse(raw) as ShiftAxExecutionHandoffDocument;
}

export async function readExecutionWorktreePath(topicDir: string): Promise<string> {
  const raw = await readArtifact(topicArtifactPath(topicDir, 'worktree_state'));
  const parsed = JSON.parse(raw) as { worktree_path?: string };
  if (!parsed.worktree_path) {
    throw new Error('worktree-state.json does not contain worktree_path');
  }
  return parsed.worktree_path;
}

function parseMarkdownSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = String(markdown || '').split(/\r?\n/);
  let currentSection: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    sections.set(currentSection, buffer.join('\n').trim());
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      currentSection = heading[1]!.trim();
      buffer = [];
      continue;
    }

    if (currentSection) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function bulletizeSection(content: string | undefined, fallback?: string): string[] {
  const items = String(content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`));

  if (items.length > 0) return items;
  return fallback ? [`- ${fallback}`] : [];
}

function buildExecutionPromptContent(input: {
  request: string;
  summary: string;
  brainstorm: string;
  spec: string;
  plan: string;
  resolvedContext: ResolvedContextSummary;
  task: ShiftAxExecutionHandoffTask;
  worktreePath: string;
}): string {
  const brainstormSections = parseMarkdownSections(input.brainstorm);
  const specSections = parseMarkdownSections(input.spec);
  const relevantDocs = (input.resolvedContext.matches ?? [])
    .map((match) => {
      const label = match.label?.trim();
      const path = match.path?.trim();
      if (!label || !path) return null;
      return `- ${label} -> ${path}`;
    })
    .filter((item): item is string => Boolean(item));
  const constraints = bulletizeSection(
    specSections.get('Constraints') || brainstormSections.get('Constraints'),
    'No extra constraints were recorded.',
  );
  const outOfScope = bulletizeSection(
    specSections.get('Out of Scope') || brainstormSections.get('Out of Scope'),
    'No out-of-scope items were recorded.',
  );
  const verification = bulletizeSection(
    specSections.get('Verification Expectations') || brainstormSections.get('Verification Expectations'),
    'No explicit verification expectations were recorded.',
  );

  return [
    `You are executing Shift AX task ${input.task.id} inside this worktree: ${input.worktreePath}`,
    '',
    `Request summary: ${input.summary.trim() || input.request.trim()}`,
    '',
    `Do this task now: ${input.task.source_text.trim()}`,
    '',
    'Relevant base-context docs to consult first if they apply:',
    ...(relevantDocs.length > 0 ? relevantDocs : ['- No directly matched base-context docs were recorded.']),
    '',
    'Constraints:',
    ...constraints,
    '',
    'Out of scope:',
    ...outOfScope,
    '',
    'Verification expectations:',
    ...verification,
    '',
    'Execution rules:',
    '- Read any listed base-context docs before editing when they are relevant.',
    '- Make the file edits now; do not stop at an explanation or plan.',
    '- Keep changes inside the assigned worktree only.',
    '- Do not widen scope beyond the assigned task.',
    '- If you cannot complete the edit, say exactly why.',
    '',
    `Routing reason: ${input.task.reason.trim()}`,
    '',
    'In your final response, briefly list changed files and tests run.',
    '',
  ].join('\n');
}

export async function materializeExecutionPrompts(
  topicDir: string,
  taskId?: string,
): Promise<ShiftAxExecutionPromptArtifact[]> {
  await assertResolvedContextReady(topicDir);
  const [handoff, worktreePath, request, summary, brainstorm, spec, plan, resolvedContextRaw] =
    await Promise.all([
      readExecutionHandoff(topicDir),
      readExecutionWorktreePath(topicDir),
      readArtifact(topicArtifactPath(topicDir, 'request')),
      readArtifact(topicArtifactPath(topicDir, 'request_summary')),
      readArtifact(topicArtifactPath(topicDir, 'brainstorm')),
      readArtifact(topicArtifactPath(topicDir, 'spec')),
      readArtifact(topicArtifactPath(topicDir, 'implementation_plan')),
      readArtifact(topicArtifactPath(topicDir, 'resolved_context')),
    ]);
  const resolvedContext = JSON.parse(resolvedContextRaw) as ResolvedContextSummary;

  const tasks = taskId
    ? handoff.tasks.filter((task) => task.id === taskId)
    : handoff.tasks;

  if (tasks.length === 0) {
    throw new Error(taskId ? `No execution task found for ${taskId}` : 'No execution tasks found');
  }

  const artifacts: ShiftAxExecutionPromptArtifact[] = [];
  for (const task of tasks) {
    const promptPath = join(topicDir, 'execution-prompts', `${task.id}.md`);
    const outputPath = join(topicDir, 'execution-results', `${task.id}.json`);
    await mkdir(dirname(promptPath), { recursive: true });
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      promptPath,
      `${buildExecutionPromptContent({
        request,
        summary,
        brainstorm,
        spec,
        plan,
        resolvedContext,
        task,
        worktreePath,
      }).trimEnd()}\n`,
      'utf8',
    );
    artifacts.push({
      task,
      worktreePath,
      promptPath,
      outputPath,
    });
  }

  return artifacts;
}
