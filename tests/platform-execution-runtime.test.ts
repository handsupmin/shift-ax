import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getPlatformAdapter } from '../adapters/index.js';

async function createTopic(root: string): Promise<{ topicDir: string; worktreePath: string }> {
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
  const worktreePath = join(root, '.ax', 'worktrees', '2026-04-08-auth-refresh');
  await mkdir(join(topicDir, 'review'), { recursive: true });
  await mkdir(join(topicDir, 'final'), { recursive: true });
  await mkdir(worktreePath, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), 'Build safer auth refresh flow\n', 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), 'Need a reviewed auth-refresh flow.\n', 'utf8');
  await writeFile(join(topicDir, 'brainstorm.md'), '# Brainstorm\n\n## Clarified Outcome\n\n- Keep users signed in.\n', 'utf8');
  await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\n## Goal\n\nKeep users signed in.\n', 'utf8');
  await writeFile(
    join(topicDir, 'implementation-plan.md'),
    [
      '# Implementation Plan',
      '',
      '1. Update auth refresh service and token store.',
      '2. Run migration analysis for token storage.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: '2026-04-08-auth-refresh',
        phase: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_review_status: 'approved',
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'worktree-state.json'),
    JSON.stringify(
      {
        version: 1,
        status: 'created',
        branch_name: 'ax/2026-04-08-auth-refresh',
        worktree_path: worktreePath,
        base_branch: 'main',
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(topicDir, 'execution-handoff.json'),
    JSON.stringify(
      {
        version: 1,
        generated_at: new Date().toISOString(),
        topic_slug: '2026-04-08-auth-refresh',
        default_short_execution: 'subagent',
        default_long_execution: 'tmux',
        tasks: [
          {
            id: 'task-1',
            source_text: 'Update auth refresh service and token store.',
            execution_mode: 'subagent',
            reason: 'Short bounded slice.',
          },
          {
            id: 'task-2',
            source_text: 'Run migration analysis for token storage.',
            execution_mode: 'tmux',
            reason: 'Long-running analysis.',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  return { topicDir, worktreePath };
}

test('platform adapters expose execution launch plans for codex and claude-code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-exec-runtime-'));

  try {
    const { topicDir } = await createTopic(root);
    const codex = getPlatformAdapter('codex');
    const claude = getPlatformAdapter('claude-code');

    const codexPlan = await codex.planExecution({ topicDir });
    const claudePlan = await claude.planExecution({ topicDir });

    assert.equal(codexPlan.tasks.length, 2);
    assert.equal(claudePlan.tasks.length, 2);
    assert.match(codexPlan.tasks[0]!.prompt_path, /execution-prompts\/task-1\.md$/);
    assert.match(codexPlan.tasks[0]!.shell_command, /codex exec/);
    assert.match(codexPlan.tasks[1]!.command.join(' '), /tmux new-session/);
    assert.match(claudePlan.tasks[0]!.shell_command, /claude -p/);
    assert.match(claudePlan.tasks[1]!.command.join(' '), /tmux new-session/);

    const prompt = await readFile(codexPlan.tasks[0]!.prompt_path, 'utf8');
    assert.match(prompt, /Shift AX Execution Task/);
    assert.match(prompt, /Update auth refresh service/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax launch-execution --dry-run prints execution launch plans', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-launch-cli-'));

  try {
    const { topicDir } = await createTopic(root);
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'launch-execution',
          '--platform',
          'codex',
          '--topic',
          topicDir,
          '--dry-run',
        ],
        {
          cwd: '/Users/sangmin/sources/shift-ax',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let output = '';
      let error = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(error || `ax launch-execution exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as {
      platform: string;
      launched: boolean;
      tasks: Array<{ execution_mode: string; shell_command: string }>;
    };

    assert.equal(result.platform, 'codex');
    assert.equal(result.launched, false);
    assert.equal(result.tasks.length, 2);
    assert.equal(result.tasks[0]!.execution_mode, 'subagent');
    assert.match(result.tasks[0]!.shell_command, /codex exec/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
