import { execFileSync } from 'node:child_process';

import type {
  ShiftAxExecutionLaunchInput,
  ShiftAxExecutionLaunchResult,
  ShiftAxExecutionTaskPlan,
  ShiftAxPlatformExecutionRuntime,
} from '../../adapters/contracts.js';
import { materializeExecutionPrompts } from '../../core/planning/execution-launch.js';
import { sanitizeCodexTeamName } from './upstream/tmux/imported/sanitize-team-name.js';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildCodexTmuxSessionName(topicSlug: string, taskId: string): string {
  return `axexec-${sanitizeCodexTeamName(`${topicSlug}-${taskId}`)}`;
}

function buildCodexExecShellCommand(plan: ShiftAxExecutionTaskPlan): string {
  return `cat ${shellQuote(plan.prompt_path)} | codex exec --full-auto -C ${shellQuote(plan.working_directory)} -o ${shellQuote(plan.output_path)} -`;
}

export function getCodexExecutionRuntime(): ShiftAxPlatformExecutionRuntime {
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
      subagent_cli: 'codex',
      tmux_cli: 'tmux',
    },
  };
}

export async function planCodexExecutionLaunch({
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
      const sessionName = buildCodexTmuxSessionName(
        topicDir.split('/').pop() || 'topic',
        artifact.task.id,
      );
      const shellCommand = buildCodexExecShellCommand({
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

    const shellCommand = buildCodexExecShellCommand({
      ...basePlan,
      command: [],
      shell_command: '',
    } as ShiftAxExecutionTaskPlan);
    return {
      ...basePlan,
      command: [
        'codex',
        'exec',
        '--full-auto',
        '-C',
        artifact.worktreePath,
        '-o',
        artifact.outputPath,
        '-',
      ],
      shell_command: shellCommand,
    } satisfies ShiftAxExecutionTaskPlan;
  });

  return {
    platform: 'codex',
    launched: false,
    topic_dir: topicDir,
    tasks,
  };
}

export async function launchCodexExecution({
  topicDir,
  taskId,
}: ShiftAxExecutionLaunchInput): Promise<ShiftAxExecutionLaunchResult> {
  const plan = await planCodexExecutionLaunch({ topicDir, taskId });

  for (const task of plan.tasks) {
    if (task.execution_mode === 'tmux') {
      execFileSync(task.command[0]!, task.command.slice(1), {
        stdio: 'pipe',
      });
      continue;
    }

    execFileSync('/bin/sh', ['-lc', task.shell_command], {
      stdio: 'pipe',
    });
  }

  return {
    ...plan,
    launched: true,
  };
}
