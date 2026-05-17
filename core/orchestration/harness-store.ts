import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type ShiftAxHarnessRunPhase =
  | 'initialized'
  | 'planning'
  | 'awaiting_plan_review'
  | 'execution_ready'
  | 'executing'
  | 'review_pending'
  | 'commit_ready'
  | 'committed'
  | 'blocked'
  | 'failed';

export type ShiftAxHarnessTaskStatus =
  | 'pending'
  | 'running'
  | 'retry_ready'
  | 'completed'
  | 'failed';

export interface ShiftAxHarnessTaskInput {
  task_id: string;
  task_kind: string;
  priority?: number;
  dependencies?: string[];
  payload?: Record<string, unknown>;
  output_path?: string;
  idempotency_key?: string;
  max_attempts?: number;
  available_at?: string;
}

export interface ShiftAxHarnessTaskRecord extends Required<Omit<ShiftAxHarnessTaskInput, 'priority' | 'dependencies' | 'payload' | 'output_path' | 'idempotency_key' | 'max_attempts' | 'available_at'>> {
  run_id: string;
  status: ShiftAxHarnessTaskStatus;
  priority: number;
  dependencies: string[];
  payload: Record<string, unknown>;
  output_path?: string;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  lease_token?: string;
  claimed_by?: string;
  started_at?: string;
  completed_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftAxHarnessRunRecord {
  run_id: string;
  topic_dir: string;
  phase: ShiftAxHarnessRunPhase;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  failure_reason?: string;
}

export interface ShiftAxClaimedTask extends ShiftAxHarnessTaskRecord {
  lease_token: string;
}

const RUN_TRANSITIONS: Record<ShiftAxHarnessRunPhase, ShiftAxHarnessRunPhase[]> = {
  initialized: ['planning', 'execution_ready', 'blocked', 'failed'],
  planning: ['awaiting_plan_review', 'blocked', 'failed'],
  awaiting_plan_review: ['execution_ready', 'blocked', 'failed'],
  execution_ready: ['executing', 'blocked', 'failed'],
  executing: ['review_pending', 'blocked', 'failed'],
  review_pending: ['commit_ready', 'executing', 'blocked', 'failed'],
  commit_ready: ['committed', 'executing', 'blocked', 'failed'],
  committed: [],
  blocked: ['planning', 'execution_ready', 'failed'],
  failed: [],
};

function sqlString(value: string | undefined): string {
  if (value === undefined) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

function numberOrDefault(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null ? undefined : value]),
  );
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return JSON.parse(value) as T;
}

function normalizeTaskRow(row: Record<string, unknown>): ShiftAxHarnessTaskRecord {
  const normalized = normalizeRow(row);
  return {
    run_id: String(normalized.run_id),
    task_id: String(normalized.task_id),
    task_kind: String(normalized.task_kind),
    status: normalized.status as ShiftAxHarnessTaskStatus,
    priority: Number(normalized.priority ?? 0),
    dependencies: parseJsonField<string[]>(normalized.dependencies_json, []),
    payload: parseJsonField<Record<string, unknown>>(normalized.payload_json, {}),
    ...(normalized.output_path ? { output_path: String(normalized.output_path) } : {}),
    idempotency_key: String(normalized.idempotency_key),
    attempt_count: Number(normalized.attempt_count ?? 0),
    max_attempts: Number(normalized.max_attempts ?? 1),
    available_at: String(normalized.available_at),
    ...(normalized.lease_token ? { lease_token: String(normalized.lease_token) } : {}),
    ...(normalized.claimed_by ? { claimed_by: String(normalized.claimed_by) } : {}),
    ...(normalized.started_at ? { started_at: String(normalized.started_at) } : {}),
    ...(normalized.completed_at ? { completed_at: String(normalized.completed_at) } : {}),
    ...(normalized.last_error ? { last_error: String(normalized.last_error) } : {}),
    created_at: String(normalized.created_at),
    updated_at: String(normalized.updated_at),
  };
}

function normalizeRunRow(row: Record<string, unknown>): ShiftAxHarnessRunRecord {
  const normalized = normalizeRow(row);
  return {
    run_id: String(normalized.run_id),
    topic_dir: String(normalized.topic_dir),
    phase: normalized.phase as ShiftAxHarnessRunPhase,
    idempotency_key: String(normalized.idempotency_key),
    created_at: String(normalized.created_at),
    updated_at: String(normalized.updated_at),
    ...(normalized.completed_at ? { completed_at: String(normalized.completed_at) } : {}),
    ...(normalized.failure_reason ? { failure_reason: String(normalized.failure_reason) } : {}),
  };
}

export function canTransitionHarnessRun(
  from: ShiftAxHarnessRunPhase,
  to: ShiftAxHarnessRunPhase,
): boolean {
  return from === to || RUN_TRANSITIONS[from].includes(to);
}

export function nextRetryAvailableAt({
  attemptCount,
  baseDelayMs = 1_000,
  maxDelayMs = 60_000,
  now = new Date(),
}: {
  attemptCount: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: Date;
}): string {
  const exponent = Math.max(0, attemptCount - 1);
  const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  return new Date(now.getTime() + delay).toISOString();
}

export class ShiftAxHarnessStore {
  readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS harness_runs (
        run_id TEXT PRIMARY KEY,
        topic_dir TEXT NOT NULL,
        phase TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        failure_reason TEXT
      );
      CREATE TABLE IF NOT EXISTS harness_tasks (
        run_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        task_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        dependencies_json TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        output_path TEXT,
        idempotency_key TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        available_at TEXT NOT NULL,
        lease_token TEXT,
        claimed_by TEXT,
        started_at TEXT,
        completed_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (run_id, task_id),
        UNIQUE (run_id, idempotency_key),
        FOREIGN KEY (run_id) REFERENCES harness_runs(run_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS harness_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES harness_runs(run_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS harness_tasks_ready_idx
        ON harness_tasks (run_id, status, available_at, priority, created_at);
    `);
  }

  createRun({
    runId = randomUUID(),
    topicDir,
    idempotencyKey = topicDir,
    now = new Date(),
  }: {
    runId?: string;
    topicDir: string;
    idempotencyKey?: string;
    now?: Date;
  }): ShiftAxHarnessRunRecord {
    const timestamp = nowIso(now);
    this.exec(`
      INSERT OR IGNORE INTO harness_runs
        (run_id, topic_dir, phase, idempotency_key, created_at, updated_at)
      VALUES
        (${sqlString(runId)}, ${sqlString(topicDir)}, 'initialized', ${sqlString(idempotencyKey)}, ${sqlString(timestamp)}, ${sqlString(timestamp)});
    `);
    return this.getRunByIdempotencyKey(idempotencyKey);
  }

  getRun(runId: string): ShiftAxHarnessRunRecord {
    const rows = this.query<Record<string, unknown>>(
      `SELECT * FROM harness_runs WHERE run_id = ${sqlString(runId)} LIMIT 1;`,
    );
    if (!rows[0]) throw new Error(`harness run not found: ${runId}`);
    return normalizeRunRow(rows[0]);
  }

  getRunByIdempotencyKey(idempotencyKey: string): ShiftAxHarnessRunRecord {
    const rows = this.query<Record<string, unknown>>(
      `SELECT * FROM harness_runs WHERE idempotency_key = ${sqlString(idempotencyKey)} LIMIT 1;`,
    );
    if (!rows[0]) throw new Error(`harness run not found for idempotency key: ${idempotencyKey}`);
    return normalizeRunRow(rows[0]);
  }

  transitionRun({
    runId,
    to,
    reason,
    now = new Date(),
  }: {
    runId: string;
    to: ShiftAxHarnessRunPhase;
    reason: string;
    now?: Date;
  }): ShiftAxHarnessRunRecord {
    const current = this.getRun(runId);
    if (!canTransitionHarnessRun(current.phase, to)) {
      throw new Error(`invalid harness transition: ${current.phase} -> ${to}`);
    }

    const timestamp = nowIso(now);
    this.exec(`
      UPDATE harness_runs
      SET phase = ${sqlString(to)},
          updated_at = ${sqlString(timestamp)},
          completed_at = ${to === 'committed' || to === 'failed' ? sqlString(timestamp) : 'completed_at'},
          failure_reason = ${to === 'failed' ? sqlString(reason) : 'failure_reason'}
      WHERE run_id = ${sqlString(runId)};
    `);
    this.recordEvent({ runId, eventType: `run.${to}`, payload: { from: current.phase, to, reason }, now });
    return this.getRun(runId);
  }

  enqueueTasks({
    runId,
    tasks,
    now = new Date(),
  }: {
    runId: string;
    tasks: ShiftAxHarnessTaskInput[];
    now?: Date;
  }): ShiftAxHarnessTaskRecord[] {
    const timestamp = nowIso(now);
    for (const task of tasks) {
      const idempotencyKey = task.idempotency_key ?? task.task_id;
      this.exec(`
        INSERT OR IGNORE INTO harness_tasks
          (run_id, task_id, task_kind, status, priority, dependencies_json, payload_json, output_path,
           idempotency_key, attempt_count, max_attempts, available_at, created_at, updated_at)
        VALUES
          (${sqlString(runId)}, ${sqlString(task.task_id)}, ${sqlString(task.task_kind)}, 'pending',
           ${numberOrDefault(task.priority, 0)}, ${sqlJson(task.dependencies ?? [])}, ${sqlJson(task.payload ?? {})},
           ${sqlString(task.output_path)}, ${sqlString(idempotencyKey)}, 0, ${Math.max(1, numberOrDefault(task.max_attempts, 1))},
           ${sqlString(task.available_at ?? timestamp)}, ${sqlString(timestamp)}, ${sqlString(timestamp)});
      `);
    }
    this.recordEvent({
      runId,
      eventType: 'tasks.enqueued',
      payload: { task_ids: tasks.map((task) => task.task_id) },
      now,
    });
    return this.listTasks(runId);
  }

  listTasks(runId: string): ShiftAxHarnessTaskRecord[] {
    return this.query<Record<string, unknown>>(
      `SELECT * FROM harness_tasks WHERE run_id = ${sqlString(runId)} ORDER BY created_at ASC, task_id ASC;`,
    ).map(normalizeTaskRow);
  }

  claimNextTask({
    runId,
    workerId,
    now = new Date(),
  }: {
    runId: string;
    workerId: string;
    now?: Date;
  }): ShiftAxClaimedTask | null {
    const timestamp = nowIso(now);
    const tasks = this.listTasks(runId);
    const byId = new Map(tasks.map((task) => [task.task_id, task]));
    const candidate = tasks
      .filter((task) => ['pending', 'retry_ready'].includes(task.status))
      .filter((task) => task.available_at <= timestamp)
      .filter((task) =>
        task.dependencies.every((dependency) => byId.get(dependency)?.status === 'completed'),
      )
      .sort((left, right) => {
        if (right.priority !== left.priority) return right.priority - left.priority;
        if (left.created_at !== right.created_at) return left.created_at.localeCompare(right.created_at);
        return left.task_id.localeCompare(right.task_id);
      })[0];

    if (!candidate) return null;

    const leaseToken = randomUUID();
    this.exec(`
      UPDATE harness_tasks
      SET status = 'running',
          attempt_count = attempt_count + 1,
          lease_token = ${sqlString(leaseToken)},
          claimed_by = ${sqlString(workerId)},
          started_at = ${sqlString(timestamp)},
          updated_at = ${sqlString(timestamp)}
      WHERE run_id = ${sqlString(runId)}
        AND task_id = ${sqlString(candidate.task_id)}
        AND status IN ('pending', 'retry_ready');
    `);
    const claimed = this.query<Record<string, unknown>>(
      `SELECT * FROM harness_tasks WHERE run_id = ${sqlString(runId)} AND task_id = ${sqlString(candidate.task_id)} AND lease_token = ${sqlString(leaseToken)} LIMIT 1;`,
    );
    if (!claimed[0]) return null;

    this.recordEvent({
      runId,
      eventType: 'task.claimed',
      payload: { task_id: candidate.task_id, worker_id: workerId },
      now,
    });
    return normalizeTaskRow(claimed[0]) as ShiftAxClaimedTask;
  }

  getTask(runId: string, taskId: string): ShiftAxHarnessTaskRecord {
    const rows = this.query<Record<string, unknown>>(
      `SELECT * FROM harness_tasks WHERE run_id = ${sqlString(runId)} AND task_id = ${sqlString(taskId)} LIMIT 1;`,
    );
    if (!rows[0]) throw new Error(`harness task not found: ${taskId}`);
    return normalizeTaskRow(rows[0]);
  }

  completeTask({
    runId,
    taskId,
    leaseToken,
    now = new Date(),
  }: {
    runId: string;
    taskId: string;
    leaseToken: string;
    now?: Date;
  }): ShiftAxHarnessTaskRecord {
    const timestamp = nowIso(now);
    const task = this.getTask(runId, taskId);
    if (task.status !== 'running' || task.lease_token !== leaseToken) {
      throw new Error(`cannot complete unleased harness task: ${taskId}`);
    }

    this.exec(`
      UPDATE harness_tasks
      SET status = 'completed',
          completed_at = ${sqlString(timestamp)},
          updated_at = ${sqlString(timestamp)},
          last_error = NULL
      WHERE run_id = ${sqlString(runId)} AND task_id = ${sqlString(taskId)};
    `);
    this.recordEvent({ runId, eventType: 'task.completed', payload: { task_id: taskId }, now });
    return this.getTask(runId, taskId);
  }

  failTask({
    runId,
    taskId,
    leaseToken,
    error,
    retryBaseDelayMs = 1_000,
    now = new Date(),
  }: {
    runId: string;
    taskId: string;
    leaseToken: string;
    error: string;
    retryBaseDelayMs?: number;
    now?: Date;
  }): ShiftAxHarnessTaskRecord {
    const task = this.getTask(runId, taskId);
    if (task.status !== 'running' || task.lease_token !== leaseToken) {
      throw new Error(`cannot fail unleased harness task: ${taskId}`);
    }

    const timestamp = nowIso(now);
    const willRetry = task.attempt_count < task.max_attempts;
    const nextAvailableAt = willRetry
      ? nextRetryAvailableAt({
          attemptCount: task.attempt_count,
          baseDelayMs: retryBaseDelayMs,
          now,
        })
      : timestamp;
    this.exec(`
      UPDATE harness_tasks
      SET status = ${sqlString(willRetry ? 'retry_ready' : 'failed')},
          lease_token = NULL,
          claimed_by = NULL,
          completed_at = ${willRetry ? 'NULL' : sqlString(timestamp)},
          available_at = ${sqlString(nextAvailableAt)},
          last_error = ${sqlString(error)},
          updated_at = ${sqlString(timestamp)}
      WHERE run_id = ${sqlString(runId)} AND task_id = ${sqlString(taskId)};
    `);
    this.recordEvent({
      runId,
      eventType: willRetry ? 'task.retry_scheduled' : 'task.failed',
      payload: { task_id: taskId, error, next_available_at: nextAvailableAt },
      now,
    });
    return this.getTask(runId, taskId);
  }

  allTerminal(runId: string): boolean {
    const tasks = this.listTasks(runId);
    return tasks.length > 0 && tasks.every((task) => ['completed', 'failed'].includes(task.status));
  }

  hasFailedTasks(runId: string): boolean {
    return this.listTasks(runId).some((task) => task.status === 'failed');
  }

  recordEvent({
    runId,
    eventType,
    payload,
    now = new Date(),
  }: {
    runId: string;
    eventType: string;
    payload: Record<string, unknown>;
    now?: Date;
  }): void {
    this.exec(`
      INSERT INTO harness_events (run_id, event_type, payload_json, created_at)
      VALUES (${sqlString(runId)}, ${sqlString(eventType)}, ${sqlJson(payload)}, ${sqlString(nowIso(now))});
    `);
  }

  listEvents(runId: string): Array<{
    event_id: number;
    run_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }> {
    return this.query<Record<string, unknown>>(
      `SELECT * FROM harness_events WHERE run_id = ${sqlString(runId)} ORDER BY event_id ASC;`,
    ).map((row) => ({
      event_id: Number(row.event_id),
      run_id: String(row.run_id),
      event_type: String(row.event_type),
      payload: parseJsonField<Record<string, unknown>>(row.payload_json, {}),
      created_at: String(row.created_at),
    }));
  }

  private exec(sql: string): void {
    execFileSync('sqlite3', [this.dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  private query<T>(sql: string): T[] {
    const output = execFileSync('sqlite3', ['-json', this.dbPath, sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output.trim() ? JSON.parse(output) as T[] : [];
  }
}
