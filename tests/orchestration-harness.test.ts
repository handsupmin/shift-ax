import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ShiftAxExecutionTaskPlan } from '../adapters/contracts.js';
import { ShiftAxHarnessStore } from '../core/orchestration/harness-store.js';
import { runHarnessQueue } from '../core/orchestration/harness-runner.js';
import { orchestrateExecutionTasks } from '../core/planning/execution-orchestrator.js';

function fixedDate(offsetMs = 0): Date {
  return new Date(Date.UTC(2026, 4, 18, 0, 0, 0, offsetMs));
}

function taskPlan({
  id,
  mode = 'subagent',
  outputPath,
  dependencies = [],
}: {
  id: string;
  mode?: 'subagent' | 'tmux';
  outputPath: string;
  dependencies?: string[];
}): ShiftAxExecutionTaskPlan {
  return {
    task_id: id,
    source_text: `Run ${id}`,
    execution_mode: mode,
    dependencies,
    working_directory: '/tmp',
    prompt_path: `/tmp/${id}.md`,
    output_path: outputPath,
    command: ['echo', id],
    shell_command: `echo ${id}`,
  };
}

test('harness store enforces finite-state transitions and run idempotency', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-fsm-'));

  try {
    const store = new ShiftAxHarnessStore(join(root, 'harness.sqlite'));
    await store.initialize();

    const run = store.createRun({
      runId: 'run-1',
      topicDir: join(root, '.shift-ax', 'topics', 'topic'),
      idempotencyKey: 'topic:one',
      now: fixedDate(),
    });
    const sameRun = store.createRun({
      runId: 'run-2',
      topicDir: join(root, '.shift-ax', 'topics', 'topic'),
      idempotencyKey: 'topic:one',
      now: fixedDate(1),
    });

    assert.equal(run.run_id, 'run-1');
    assert.equal(sameRun.run_id, 'run-1');
    assert.throws(
      () =>
        store.transitionRun({
          runId: run.run_id,
          to: 'committed',
          reason: 'skip gates',
          now: fixedDate(2),
        }),
      /invalid harness transition/i,
    );

    assert.equal(
      store.transitionRun({
        runId: run.run_id,
        to: 'planning',
        reason: 'planning starts',
        now: fixedDate(3),
      }).phase,
      'planning',
    );
    assert.equal(
      store.transitionRun({
        runId: run.run_id,
        to: 'awaiting_plan_review',
        reason: 'plan ready',
        now: fixedDate(4),
      }).phase,
      'awaiting_plan_review',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('harness queue claims DAG-ready tasks only and applies retry scheduling', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-queue-'));

  try {
    const store = new ShiftAxHarnessStore(join(root, 'harness.sqlite'));
    await store.initialize();
    const run = store.createRun({
      runId: 'run-queue',
      topicDir: join(root, '.shift-ax', 'topics', 'topic'),
      now: fixedDate(),
    });
    store.enqueueTasks({
      runId: run.run_id,
      now: fixedDate(1),
      tasks: [
        {
          task_id: 'task-a',
          task_kind: 'script',
          priority: 1,
          max_attempts: 2,
        },
        {
          task_id: 'task-b',
          task_kind: 'script',
          priority: 10,
          dependencies: ['task-a'],
        },
      ],
    });

    const first = store.claimNextTask({
      runId: run.run_id,
      workerId: 'worker-1',
      now: fixedDate(2),
    });
    assert.equal(first?.task_id, 'task-a');
    const retry = store.failTask({
      runId: run.run_id,
      taskId: 'task-a',
      leaseToken: first!.lease_token,
      error: 'transient executor failure',
      retryBaseDelayMs: 1_000,
      now: fixedDate(3),
    });
    assert.equal(retry.status, 'retry_ready');
    assert.equal(
      store.claimNextTask({
        runId: run.run_id,
        workerId: 'worker-1',
        now: fixedDate(4),
      }),
      null,
    );

    const retried = store.claimNextTask({
      runId: run.run_id,
      workerId: 'worker-1',
      now: new Date(fixedDate(3).getTime() + 1_001),
    });
    assert.equal(retried?.task_id, 'task-a');
    store.completeTask({
      runId: run.run_id,
      taskId: 'task-a',
      leaseToken: retried!.lease_token,
      now: fixedDate(5),
    });
    const dependent = store.claimNextTask({
      runId: run.run_id,
      workerId: 'worker-1',
      now: fixedDate(6),
    });
    assert.equal(dependent?.task_id, 'task-b');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runHarnessQueue invokes only registered deterministic executors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-runner-'));

  try {
    const store = new ShiftAxHarnessStore(join(root, 'harness.sqlite'));
    await store.initialize();
    const run = store.createRun({
      runId: 'run-runner',
      topicDir: join(root, '.shift-ax', 'topics', 'topic'),
      now: fixedDate(),
    });
    store.enqueueTasks({
      runId: run.run_id,
      now: fixedDate(1),
      tasks: [
        { task_id: 'known', task_kind: 'script' },
        { task_id: 'unknown', task_kind: 'agent' },
      ],
    });

    const result = await runHarnessQueue({
      store,
      runId: run.run_id,
      workerId: 'worker-1',
      executors: {
        script: async () => {},
      },
      now: () => fixedDate(2),
    });

    assert.equal(result.completed_count, 1);
    assert.equal(result.failed_count, 1);
    assert.equal(store.getTask(run.run_id, 'known').status, 'completed');
    assert.equal(store.getTask(run.run_id, 'unknown').status, 'failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('execution orchestrator persists deterministic SQLite harness state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-orchestrator-'));
  const topicDir = join(root, '.shift-ax', 'topics', 'topic');

  try {
    await mkdir(topicDir, { recursive: true });
    const outputA = join(topicDir, 'execution-results', 'task-a.json');
    const outputB = join(topicDir, 'execution-results', 'task-b.json');
    const harnessDbPath = join(topicDir, 'harness.sqlite');
    const calls: string[] = [];

    const state = await orchestrateExecutionTasks({
      topicDir,
      harnessDbPath,
      tasks: [
        taskPlan({ id: 'task-a', outputPath: outputA }),
        taskPlan({ id: 'task-b', mode: 'tmux', outputPath: outputB, dependencies: ['task-a'] }),
      ],
      runTask: async (task) => {
        calls.push(task.task_id);
        await mkdir(join(topicDir, 'execution-results'), { recursive: true });
        await writeFile(
          task.output_path,
          JSON.stringify({ changed_files: [], summary: task.task_id }, null, 2),
          'utf8',
        );
      },
    });

    assert.equal(state.overall_status, 'completed');
    assert.deepEqual(calls, ['task-a', 'task-b']);
    assert.equal(existsSync(harnessDbPath), true);
    const persisted = JSON.parse(await readFile(join(topicDir, 'execution-state.json'), 'utf8')) as {
      overall_status: string;
      tasks: Array<{ task_id: string; status: string }>;
    };
    assert.equal(persisted.overall_status, 'completed');
    assert.deepEqual(
      persisted.tasks.map((task) => [task.task_id, task.status]),
      [
        ['task-a', 'completed'],
        ['task-b', 'completed'],
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('execution orchestrator retries transient task failures before review handoff', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-retry-'));
  const topicDir = join(root, '.shift-ax', 'topics', 'topic');

  try {
    await mkdir(topicDir, { recursive: true });
    const outputPath = join(topicDir, 'execution-results', 'task-a.json');
    const harnessDbPath = join(topicDir, 'harness.sqlite');
    const calls: string[] = [];

    const state = await orchestrateExecutionTasks({
      topicDir,
      harnessDbPath,
      maxAttempts: 2,
      retryBaseDelayMs: 0,
      tasks: [taskPlan({ id: 'task-a', outputPath })],
      runTask: async (task) => {
        calls.push(task.task_id);
        if (calls.length === 1) throw new Error('transient executor failure');
        await mkdir(join(topicDir, 'execution-results'), { recursive: true });
        await writeFile(task.output_path, JSON.stringify({ summary: 'retried' }), 'utf8');
      },
    });

    assert.equal(state.overall_status, 'completed');
    assert.deepEqual(calls, ['task-a', 'task-a']);
    const store = new ShiftAxHarnessStore(harnessDbPath);
    await store.initialize();
    const run = store.getRunByIdempotencyKey(`execution:${topicDir}`);
    assert.equal(run.phase, 'review_pending');
    assert.equal(store.getTask(run.run_id, 'task-a').attempt_count, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('execution orchestrator re-enters executing from review_pending idempotently', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-harness-rerun-'));
  const topicDir = join(root, '.shift-ax', 'topics', 'topic');

  try {
    await mkdir(topicDir, { recursive: true });
    const outputPath = join(topicDir, 'execution-results', 'task-a.json');
    const harnessDbPath = join(topicDir, 'harness.sqlite');
    const calls: string[] = [];
    const tasks = [taskPlan({ id: 'task-a', outputPath })];

    await orchestrateExecutionTasks({
      topicDir,
      harnessDbPath,
      tasks,
      runTask: async (task) => {
        calls.push(task.task_id);
        await mkdir(join(topicDir, 'execution-results'), { recursive: true });
        await writeFile(task.output_path, JSON.stringify({ summary: 'first run' }), 'utf8');
      },
    });

    const rerun = await orchestrateExecutionTasks({
      topicDir,
      harnessDbPath,
      tasks,
      runTask: async () => {
        throw new Error('completed output should not be executed again');
      },
    });

    assert.equal(rerun.overall_status, 'completed');
    assert.deepEqual(calls, ['task-a']);
    const store = new ShiftAxHarnessStore(harnessDbPath);
    await store.initialize();
    const run = store.getRunByIdempotencyKey(`execution:${topicDir}`);
    assert.equal(run.phase, 'review_pending');
    assert.equal(store.getTask(run.run_id, 'task-a').attempt_count, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
