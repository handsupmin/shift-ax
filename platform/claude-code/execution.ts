import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type {
  ShiftAxExecutionLaunchInput,
  ShiftAxExecutionLaunchResult,
  ShiftAxExecutionTaskPlan,
  ShiftAxPlatformExecutionRuntime,
} from '../../adapters/contracts.js';
import { materializeExecutionPrompts } from '../../core/planning/execution-launch.js';
import { buildClaudeWorkerSessionName } from './upstream/tmux/imported/session-name.js';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildClaudeExecShellCommand(plan: ShiftAxExecutionTaskPlan): string {
  return `claude -p --output-format text --permission-mode bypassPermissions --no-session-persistence --add-dir ${shellQuote(plan.working_directory)} \"$(cat ${shellQuote(plan.prompt_path)})\" > ${shellQuote(plan.output_path)}`;
}

function formatProcessError(error: unknown): string {
  const failure = error as { message?: string; stdout?: string | Buffer; stderr?: string | Buffer };
  const stdout =
    typeof failure.stdout === 'string'
      ? failure.stdout
      : failure.stdout instanceof Buffer
        ? failure.stdout.toString('utf8')
        : '';
  const stderr =
    typeof failure.stderr === 'string'
      ? failure.stderr
      : failure.stderr instanceof Buffer
        ? failure.stderr.toString('utf8')
        : '';
  return [failure.message ?? 'process failed', stdout.trim(), stderr.trim()]
    .filter(Boolean)
    .join('\n');
}

function claudeExecutionTimeoutMs(): number {
  const parsed = Number(process.env.SHIFT_AX_CLAUDE_EXEC_TIMEOUT_MS || '45000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}

function clearExistingTmuxSession(sessionName: string): void {
  try {
    execFileSync('tmux', ['has-session', '-t', sessionName], {
      stdio: 'pipe',
    });
    execFileSync('tmux', ['kill-session', '-t', sessionName], {
      stdio: 'pipe',
    });
  } catch {
    // no existing session to clear
  }
}

export function getClaudeCodeExecutionRuntime(): ShiftAxPlatformExecutionRuntime {
  return {
    support: 'available',
    entrypoint_style: 'cli',
    execution_handoff_artifact: 'execution-handoff.json',
    operations: {
      launch: {
        command: ['ax', 'launch-execution'],
        topic_flag: '--topic',
        additional_flags: ['--platform', '--task-id', '--dry-run'],
      },
    },
    hosts: {
      subagent_cli: 'claude',
      tmux_cli: 'tmux',
    },
  };
}

export async function planClaudeCodeExecutionLaunch({
  topicDir,
  taskId,
}: ShiftAxExecutionLaunchInput): Promise<ShiftAxExecutionLaunchResult> {
  const artifacts = await materializeExecutionPrompts(topicDir, taskId);

  const tasks = artifacts.map((artifact) => {
    const basePlan = {
      task_id: artifact.task.id,
      source_text: artifact.task.source_text,
      execution_mode: artifact.task.execution_mode,
      working_directory: artifact.worktreePath,
      prompt_path: artifact.promptPath,
      output_path: artifact.outputPath,
    };

    if (artifact.task.execution_mode === 'tmux') {
      const sessionName = buildClaudeWorkerSessionName(
        topicDir.split('/').pop() || 'topic',
        artifact.task.id,
      );
      const shellCommand = buildClaudeExecShellCommand({
        ...basePlan,
        command: [],
        shell_command: '',
      } as ShiftAxExecutionTaskPlan);
      return {
        ...basePlan,
        command: [
          'tmux',
          'new-session',
          '-d',
          '-s',
          sessionName,
          '-c',
          artifact.worktreePath,
          shellCommand,
        ],
        shell_command: shellCommand,
        session_name: sessionName,
      } satisfies ShiftAxExecutionTaskPlan;
    }

    const shellCommand = buildClaudeExecShellCommand({
      ...basePlan,
      command: [],
      shell_command: '',
    } as ShiftAxExecutionTaskPlan);
    return {
      ...basePlan,
      command: [
        '/bin/sh',
        '-lc',
        shellCommand,
      ],
      shell_command: shellCommand,
    } satisfies ShiftAxExecutionTaskPlan;
  });

  return {
    platform: 'claude-code',
    launched: false,
    topic_dir: topicDir,
    tasks,
  };
}

export async function launchClaudeCodeExecution({
  topicDir,
  taskId,
}: ShiftAxExecutionLaunchInput): Promise<ShiftAxExecutionLaunchResult> {
  const plan = await planClaudeCodeExecutionLaunch({ topicDir, taskId });

  for (const task of plan.tasks) {
    if (task.execution_mode === 'tmux') {
      if (task.session_name) {
        clearExistingTmuxSession(task.session_name);
      }
      execFileSync(task.command[0]!, task.command.slice(1), {
        stdio: 'pipe',
      });
      continue;
    }

    try {
      const output = execFileSync(
        'claude',
        [
          '-p',
          '--output-format',
          'text',
          '--permission-mode',
          'bypassPermissions',
          '--no-session-persistence',
          '--add-dir',
          task.working_directory,
          readFileSync(task.prompt_path, 'utf8'),
        ],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: claudeExecutionTimeoutMs(),
        },
      );
      mkdirSync(dirname(task.output_path), { recursive: true });
      writeFileSync(task.output_path, output, 'utf8');
    } catch (error) {
      throw new Error(`Claude Code execution failed for ${task.task_id}: ${formatProcessError(error)}`);
    }
  }

  return {
    ...plan,
    launched: true,
  };
}
