import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ShiftAxExecutionTaskPlan } from '../../adapters/contracts.js';
import { ShiftAxHarnessStore } from '../orchestration/harness-store.js';
import { runHarnessQueue } from '../orchestration/harness-runner.js';
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
  harnessDbPath?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function hasUsableOutput(path: string): Promise<boolean> {
  try {
    const details = await stat(path);
    return details.size > 0;
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

function hasOpenTasks(records: Array<{ status: string }>): boolean {
  return records.some((record) => ['pending', 'retry_ready', 'running'].includes(record.status));
}

function nextRetryDelayMs(records: Array<{ status: string; available_at: string }>, nowMs: number): number | null {
  const retryTimes = records
    .filter((record) => record.status === 'retry_ready')
    .map((record) => Date.parse(record.available_at))
    .filter((time) => Number.isFinite(time));
  if (retryTimes.length === 0) return null;
  return Math.max(0, Math.min(...retryTimes) - nowMs);
}

export async function orchestrateExecutionTasks({
  topicDir,
  tasks,
  runTask,
  pollIntervalMs = 50,
  timeoutMs = 60_000,
  harnessDbPath = join(topicDir, 'harness.sqlite'),
  maxAttempts = 1,
  retryBaseDelayMs = 1_000,
}: OrchestrateExecutionTasksInput): Promise<ShiftAxExecutionState> {
  const startedAt = new Date().toISOString();
  const store = new ShiftAxHarnessStore(harnessDbPath);
  await store.initialize();
  const run = store.createRun({
    topicDir,
    idempotencyKey: `execution:${topicDir}`,
  });
  if (run.phase === 'initialized') {
    store.transitionRun({
      runId: run.run_id,
      to: 'execution_ready',
      reason: 'Execution tasks were materialized from the approved implementation plan.',
    });
  }
  const currentRun = store.getRun(run.run_id);
  if (['execution_ready', 'review_pending', 'commit_ready'].includes(currentRun.phase)) {
    store.transitionRun({
      runId: run.run_id,
      to: 'executing',
      reason: 'Deterministic DAG queue execution started.',
    });
  }
  const taskIds = new Set(tasks.map((task) => task.task_id));
  store.enqueueTasks({
    runId: run.run_id,
    tasks: tasks.map((task, index) => ({
      task_id: task.task_id,
      task_kind: task.execution_mode,
      priority: tasks.length - index,
      dependencies: (task.dependencies ?? []).filter((dependency) => taskIds.has(dependency)),
      payload: {
        source_text: task.source_text,
        execution_mode: task.execution_mode,
        shell_command: task.shell_command,
        prompt_path: task.prompt_path,
      },
      output_path: task.output_path,
      idempotency_key: `execution:${task.task_id}:${task.output_path}`,
      max_attempts: maxAttempts,
    })),
  });

  const byTaskId = new Map(tasks.map((task) => [task.task_id, task]));
  const executors = {
    subagent: async (claimed: { task_id: string }) => {
      const task = byTaskId.get(claimed.task_id);
      if (!task) throw new Error(`Unknown execution task: ${claimed.task_id}`);
      await mkdir(dirname(task.output_path), { recursive: true });
      if (await hasUsableOutput(task.output_path)) return;
      await runTask(task);
      await waitForOutput(task.output_path, pollIntervalMs, timeoutMs);
    },
    tmux: async (claimed: { task_id: string }) => {
      const task = byTaskId.get(claimed.task_id);
      if (!task) throw new Error(`Unknown execution task: ${claimed.task_id}`);
      await mkdir(dirname(task.output_path), { recursive: true });
      if (await hasUsableOutput(task.output_path)) return;
      await runTask(task);
      await waitForOutput(task.output_path, pollIntervalMs, timeoutMs);
    },
  };

  const queueDeadline = Date.now() + timeoutMs;
  const maxQueueCycles = Math.max(1, tasks.length * Math.max(1, maxAttempts) + maxAttempts + 1);
  for (let cycle = 0; cycle < maxQueueCycles; cycle += 1) {
    await runHarnessQueue({
      store,
      runId: run.run_id,
      workerId: 'shift-ax-execution-orchestrator',
      executors,
      retryBaseDelayMs,
      maxSteps: Math.max(1, tasks.length + 1),
    });

    const queueRecords = store.listTasks(run.run_id);
    if (!hasOpenTasks(queueRecords)) break;

    const delayMs = nextRetryDelayMs(queueRecords, Date.now());
    if (delayMs === null || Date.now() >= queueDeadline) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, pollIntervalMs, queueDeadline - Date.now())));
  }

  const records = store.listTasks(run.run_id);
  const taskStates: ShiftAxExecutionTaskState[] = records.map((record) => {
    const task = byTaskId.get(record.task_id);
    return {
      task_id: record.task_id,
      execution_mode: task?.execution_mode ?? 'subagent',
      status: record.status === 'completed'
        ? 'completed'
        : record.status === 'failed' && /timed out/i.test(record.last_error ?? '')
          ? 'timed_out'
          : 'failed',
      output_path: record.output_path ?? task?.output_path ?? '',
      ...(task?.session_name ? { session_name: task.session_name } : {}),
      started_at: record.started_at ?? record.created_at,
      ...(record.completed_at ? { completed_at: record.completed_at } : {}),
      ...(record.last_error ? { error: record.last_error } : {}),
    };
  });

  if (store.hasFailedTasks(run.run_id)) {
    store.transitionRun({
      runId: run.run_id,
      to: 'failed',
      reason: 'At least one deterministic execution task failed.',
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

  const incompleteTasks = records.filter((record) => record.status !== 'completed');
  if (incompleteTasks.length > 0) {
    store.transitionRun({
      runId: run.run_id,
      to: 'failed',
      reason: 'Deterministic execution queue stopped before all tasks completed.',
    });
    const failedState: ShiftAxExecutionState = {
      version: 1,
      overall_status: 'failed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      tasks: taskStates.map((task) => task.status === 'completed'
        ? task
        : {
            ...task,
            status: 'failed',
            completed_at: task.completed_at ?? new Date().toISOString(),
            error: task.error ?? `Task did not reach completed state.`,
          }),
    };
    await writeExecutionState(topicDir, failedState);
    return failedState;
  }

  store.transitionRun({
    runId: run.run_id,
    to: 'review_pending',
    reason: 'All deterministic execution tasks completed.',
  });

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
