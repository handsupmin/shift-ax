import { readFile, writeFile } from 'node:fs/promises';

import { readProjectProfile } from '../policies/project-profile.js';
import { getRootDirFromTopicDir, topicArtifactPath } from '../topics/topic-artifacts.js';

export interface ShiftAxExecutionTask {
  id: string;
  source_text: string;
  execution_mode: 'subagent' | 'tmux';
  reason: string;
}

export interface ShiftAxExecutionHandoff {
  version: 1;
  generated_at: string;
  topic_slug: string;
  default_short_execution: string;
  default_long_execution: string;
  tasks: ShiftAxExecutionTask[];
}

function extractPlanTasks(plan: string): string[] {
  const lines = String(plan || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  const taskLines = lines.filter((line) => /^[-*]\s+|^\d+\.\s+/.test(line));
  if (taskLines.length > 0) {
    return taskLines.map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim());
  }

  return lines;
}

function pickExecutionMode(task: string, shortExecution: string, longExecution: string): {
  executionMode: 'subagent' | 'tmux';
  reason: string;
} {
  const normalized = task.toLowerCase();
  const longSignals = ['migration', 'long-running', 'cross-cutting', 'multi-service', 'analysis', 'tmux'];
  const isLong = longSignals.some((signal) => normalized.includes(signal));

  return isLong
    ? {
        executionMode: 'tmux',
        reason: `Matched long-running signal; route through ${longExecution}.`,
      }
    : {
        executionMode: 'subagent',
        reason: `Fits a shorter bounded slice; route through ${shortExecution}.`,
      };
}

export async function buildExecutionHandoff(
  topicDir: string,
  now = new Date(),
): Promise<ShiftAxExecutionHandoff> {
  const [plan, workflow, profile] = await Promise.all([
    readFile(topicArtifactPath(topicDir, 'implementation_plan'), 'utf8'),
    readFile(topicArtifactPath(topicDir, 'workflow_state'), 'utf8'),
    readProjectProfile(getRootDirFromTopicDir(topicDir)),
  ]);

  const parsedWorkflow = JSON.parse(workflow) as { topic_slug: string };
  const shortExecution = profile?.engineering_defaults.short_task_execution ?? 'subagent';
  const longExecution = profile?.engineering_defaults.long_task_execution ?? 'tmux';
  const tasks = extractPlanTasks(plan).map((task, index) => {
    const routing = pickExecutionMode(task, shortExecution, longExecution);
    return {
      id: `task-${index + 1}`,
      source_text: task,
      execution_mode: routing.executionMode,
      reason: routing.reason,
    } satisfies ShiftAxExecutionTask;
  });

  return {
    version: 1,
    generated_at: now.toISOString(),
    topic_slug: parsedWorkflow.topic_slug,
    default_short_execution: shortExecution,
    default_long_execution: longExecution,
    tasks,
  };
}

export async function writeExecutionHandoff(topicDir: string, now = new Date()): Promise<ShiftAxExecutionHandoff> {
  const handoff = await buildExecutionHandoff(topicDir, now);
  await writeFile(
    topicArtifactPath(topicDir, 'execution_handoff'),
    `${JSON.stringify(handoff, null, 2)}\n`,
    'utf8',
  );
  return handoff;
}
