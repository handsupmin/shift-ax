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

function buildExecutionPromptContent(input: {
  request: string;
  summary: string;
  brainstorm: string;
  spec: string;
  plan: string;
  task: ShiftAxExecutionHandoffTask;
  worktreePath: string;
}): string {
  return [
    '# Shift AX Execution Task',
    '',
    `- Task ID: ${input.task.id}`,
    `- Execution Mode: ${input.task.execution_mode}`,
    `- Worktree: ${input.worktreePath}`,
    '',
    '## Request Summary',
    '',
    input.summary.trim() || input.request.trim(),
    '',
    '## Assigned Task',
    '',
    input.task.source_text.trim(),
    '',
    '## Routing Reason',
    '',
    input.task.reason.trim(),
    '',
    '## Constraints',
    '',
    '- Do not guess when the artifacts can answer.',
    '- Follow the spec and implementation plan before making code changes.',
    '- Keep changes inside the assigned worktree.',
    '- Preserve the reviewed scope and out-of-scope boundaries.',
    '',
    '## Brainstorm',
    '',
    input.brainstorm.trim(),
    '',
    '## Spec',
    '',
    input.spec.trim(),
    '',
    '## Implementation Plan',
    '',
    input.plan.trim(),
    '',
  ].join('\n');
}

export async function materializeExecutionPrompts(
  topicDir: string,
  taskId?: string,
): Promise<ShiftAxExecutionPromptArtifact[]> {
  await assertResolvedContextReady(topicDir);
  const [handoff, worktreePath, request, summary, brainstorm, spec, plan] =
    await Promise.all([
      readExecutionHandoff(topicDir),
      readExecutionWorktreePath(topicDir),
      readArtifact(topicArtifactPath(topicDir, 'request')),
      readArtifact(topicArtifactPath(topicDir, 'request_summary')),
      readArtifact(topicArtifactPath(topicDir, 'brainstorm')),
      readArtifact(topicArtifactPath(topicDir, 'spec')),
      readArtifact(topicArtifactPath(topicDir, 'implementation_plan')),
    ]);

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
