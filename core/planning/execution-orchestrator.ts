import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ShiftAxExecutionTaskPlan } from '../../adapters/contracts.js';
import { topicArtifactPath } from '../topics/topic-artifacts.js';

export interface ShiftAxExecutionTaskState {
  task_id: string;
  execution_mode: 'subagent' | 'tmux';
  status: 'completed' | 'failed' | 'timed_out';
  output_path: string;
  session_name?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface ShiftAxExecutionState {
  version: 1;
  overall_status: 'completed' | 'failed';
  started_at: string;
  completed_at: string;
  tasks: ShiftAxExecutionTaskState[];
}

export interface OrchestrateExecutionTasksInput {
  topicDir: string;
  tasks: ShiftAxExecutionTaskPlan[];
  runTask: (task: ShiftAxExecutionTaskPlan) => Promise<void>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function waitForOutput(path: string, pollIntervalMs: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    if (await pathExists(path)) return;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Timed out waiting for execution output: ${path}`);
}

async function writeExecutionState(topicDir: string, state: ShiftAxExecutionState): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'execution_state'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}

export async function orchestrateExecutionTasks({
  topicDir,
  tasks,
  runTask,
  pollIntervalMs = 50,
  timeoutMs = 60_000,
}: OrchestrateExecutionTasksInput): Promise<ShiftAxExecutionState> {
  const startedAt = new Date().toISOString();
  const taskStates: ShiftAxExecutionTaskState[] = [];

  for (const task of tasks) {
    const taskStartedAt = new Date().toISOString();
    try {
      await mkdir(dirname(task.output_path), { recursive: true });
      await runTask(task);
      await waitForOutput(task.output_path, pollIntervalMs, timeoutMs);
      taskStates.push({
        task_id: task.task_id,
        execution_mode: task.execution_mode,
        status: 'completed',
        output_path: task.output_path,
        ...(task.session_name ? { session_name: task.session_name } : {}),
        started_at: taskStartedAt,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      taskStates.push({
        task_id: task.task_id,
        execution_mode: task.execution_mode,
        status: /timed out/i.test(message) ? 'timed_out' : 'failed',
        output_path: task.output_path,
        ...(task.session_name ? { session_name: task.session_name } : {}),
        started_at: taskStartedAt,
        completed_at: new Date().toISOString(),
        error: message,
      });

      const failedState: ShiftAxExecutionState = {
        version: 1,
        overall_status: 'failed',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        tasks: taskStates,
      };
      await writeExecutionState(topicDir, failedState);
      return failedState;
    }
  }

  const state: ShiftAxExecutionState = {
    version: 1,
    overall_status: 'completed',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    tasks: taskStates,
  };
  await writeExecutionState(topicDir, state);
  return state;
}
