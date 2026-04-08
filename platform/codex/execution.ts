import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
  const topicPart = sanitizeCodexTeamName(topicSlug).slice(0, 18).replace(/-$/, '');
  const taskPart = sanitizeCodexTeamName(taskId).slice(0, 8).replace(/-$/, '');
  return `axexec-${topicPart}-${taskPart}`;
}

function buildCodexExecShellCommand(plan: ShiftAxExecutionTaskPlan): string {
  return `codex exec --full-auto -C ${shellQuote(plan.working_directory)} -o ${shellQuote(plan.output_path)} \"$(cat ${shellQuote(plan.prompt_path)})\"`;
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

function codexExecutionTimeoutMs(): number {
  const parsed = Number(process.env.SHIFT_AX_CODEX_EXEC_TIMEOUT_MS || '180000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
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
      if (task.session_name) {
        clearExistingTmuxSession(task.session_name);
      }
      execFileSync(task.command[0]!, task.command.slice(1), {
        stdio: 'pipe',
      });
      continue;
    }

    try {
      execFileSync(
        'codex',
        [
          'exec',
          '--full-auto',
          '-C',
          task.working_directory,
          '-o',
          task.output_path,
          readFileSync(task.prompt_path, 'utf8'),
        ],
        {
          cwd: task.working_directory,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: codexExecutionTimeoutMs(),
        },
      );
    } catch (error) {
      throw new Error(`Codex execution failed for ${task.task_id}: ${formatProcessError(error)}`);
    }
  }

  return {
    ...plan,
    launched: true,
  };
}
