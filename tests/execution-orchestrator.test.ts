import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { orchestrateExecutionTasks } from '../core/planning/execution-orchestrator.js';

test('orchestrateExecutionTasks records task results and waits for output artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-exec-orchestrator-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-exec');
  const worktreePath = join(root, '.ax', 'worktrees', '2026-04-08-exec');

  try {
    await mkdir(topicDir, { recursive: true });
    await mkdir(worktreePath, { recursive: true });

    const result = await orchestrateExecutionTasks({
      topicDir,
      tasks: [
        {
          task_id: 'task-1',
          source_text: 'Short slice',
          execution_mode: 'subagent',
          working_directory: worktreePath,
          prompt_path: join(topicDir, 'execution-prompts', 'task-1.md'),
          output_path: join(topicDir, 'execution-results', 'task-1.json'),
          command: ['echo', 'task-1'],
          shell_command: 'echo task-1',
        },
        {
          task_id: 'task-2',
          source_text: 'Long slice',
          execution_mode: 'tmux',
          working_directory: worktreePath,
          prompt_path: join(topicDir, 'execution-prompts', 'task-2.md'),
          output_path: join(topicDir, 'execution-results', 'task-2.json'),
          command: ['tmux', 'new-session', '-d'],
          shell_command: 'echo task-2',
          session_name: 'axexec-task-2',
        },
      ],
      runTask: async (task) => {
        if (task.task_id === 'task-1') {
          await writeFile(task.output_path, '{"status":"ok","task":"task-1"}\n', 'utf8');
          await writeFile(join(worktreePath, 'task-1.txt'), 'done\n', 'utf8');
          return;
        }

        setTimeout(async () => {
          await writeFile(task.output_path, '{"status":"ok","task":"task-2"}\n', 'utf8');
          await writeFile(join(worktreePath, 'task-2.txt'), 'done\n', 'utf8');
        }, 50);
      },
      pollIntervalMs: 10,
      timeoutMs: 1000,
    });

    const state = JSON.parse(
      await readFile(join(topicDir, 'execution-state.json'), 'utf8'),
    ) as {
      overall_status: string;
      tasks: Array<{ task_id: string; status: string; output_path: string }>;
    };

    assert.equal(result.overall_status, 'completed');
    assert.equal(state.overall_status, 'completed');
    assert.equal(state.tasks.length, 2);
    assert.equal(state.tasks[0]?.status, 'completed');
    assert.equal(state.tasks[1]?.status, 'completed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('orchestrateExecutionTasks reuses an existing non-empty output artifact instead of re-running the task', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-exec-orchestrator-reuse-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-exec');
  const worktreePath = join(root, '.ax', 'worktrees', '2026-04-08-exec');

  try {
    await mkdir(topicDir, { recursive: true });
    await mkdir(worktreePath, { recursive: true });
    const outputPath = join(topicDir, 'execution-results', 'task-1.json');
    await mkdir(join(topicDir, 'execution-results'), { recursive: true });
    await writeFile(outputPath, '{"status":"ok","task":"task-1"}\n', 'utf8');

    let runCount = 0;
    const result = await orchestrateExecutionTasks({
      topicDir,
      tasks: [
        {
          task_id: 'task-1',
          source_text: 'Short slice',
          execution_mode: 'subagent',
          working_directory: worktreePath,
          prompt_path: join(topicDir, 'execution-prompts', 'task-1.md'),
          output_path: outputPath,
          command: ['echo', 'task-1'],
          shell_command: 'echo task-1',
        },
      ],
      runTask: async () => {
        runCount += 1;
      },
      pollIntervalMs: 10,
      timeoutMs: 1000,
    });

    assert.equal(result.overall_status, 'completed');
    assert.equal(runCount, 0);
    assert.equal(result.tasks[0]?.status, 'completed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
