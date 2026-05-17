import type {
  ShiftAxClaimedTask,
  ShiftAxHarnessStore,
  ShiftAxHarnessTaskRecord,
} from './harness-store.js';

export type ShiftAxHarnessTaskExecutor = (task: ShiftAxClaimedTask) => Promise<void>;

export interface RunHarnessQueueInput {
  store: ShiftAxHarnessStore;
  runId: string;
  workerId: string;
  executors: Record<string, ShiftAxHarnessTaskExecutor>;
  maxSteps?: number;
  retryBaseDelayMs?: number;
  now?: () => Date;
}

export interface RunHarnessQueueResult {
  claimed_count: number;
  completed_count: number;
  failed_count: number;
  idle: boolean;
  tasks: ShiftAxHarnessTaskRecord[];
}

export async function runHarnessQueue({
  store,
  runId,
  workerId,
  executors,
  maxSteps = 100,
  retryBaseDelayMs = 1_000,
  now = () => new Date(),
}: RunHarnessQueueInput): Promise<RunHarnessQueueResult> {
  let claimedCount = 0;
  let completedCount = 0;
  let failedCount = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const task = store.claimNextTask({
      runId,
      workerId,
      now: now(),
    });
    if (!task) break;

    claimedCount += 1;
    const executor = executors[task.task_kind];
    if (!executor) {
      store.failTask({
        runId,
        taskId: task.task_id,
        leaseToken: task.lease_token,
        error: `No deterministic executor registered for task kind: ${task.task_kind}`,
        retryBaseDelayMs,
        now: now(),
      });
      failedCount += 1;
      continue;
    }

    try {
      await executor(task);
      store.completeTask({
        runId,
        taskId: task.task_id,
        leaseToken: task.lease_token,
        now: now(),
      });
      completedCount += 1;
    } catch (error) {
      store.failTask({
        runId,
        taskId: task.task_id,
        leaseToken: task.lease_token,
        error: error instanceof Error ? error.message : String(error),
        retryBaseDelayMs,
        now: now(),
      });
      failedCount += 1;
    }
  }

  const tasks = store.listTasks(runId);
  return {
    claimed_count: claimedCount,
    completed_count: completedCount,
    failed_count: failedCount,
    idle: !tasks.some((task) => ['pending', 'retry_ready', 'running'].includes(task.status)),
    tasks,
  };
}
