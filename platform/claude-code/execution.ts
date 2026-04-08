import { execFileSync } from 'node:child_process';

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
  return `cat ${shellQuote(plan.prompt_path)} | claude -p --output-format json --permission-mode bypassPermissions --add-dir ${shellQuote(plan.working_directory)} > ${shellQuote(plan.output_path)}`;
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
    execFileSync(task.command[0]!, task.command.slice(1), {
      stdio: 'pipe',
    });
  }

  return {
    ...plan,
    launched: true,
  };
}
