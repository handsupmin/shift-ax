import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax refresh-state writes .ax/STATE.md', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-refresh-state-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-09-auth-fix',
          phase: 'commit_ready',
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
      join(topicDir, 'execution-state.json'),
      JSON.stringify({ version: 1, overall_status: 'completed', tasks: [] }, null, 2),
      'utf8',
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'refresh-state', '--root', root],
        {
          cwd: REPO_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let error = '';
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(error || `ax refresh-state exited ${code}`));
      });
    });

    const content = await readFile(join(root, '.ax', 'STATE.md'), 'utf8');
    assert.match(content, /2026-04-09-auth-fix/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax pause-work writes topic handoff and refreshes root state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-pause-work-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-09-auth-fix',
          phase: 'implementation_running',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
          review: {
            overall_status: 'changes_requested',
            commit_allowed: false,
            next_stage: 'implementation',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'execution-state.json'),
      JSON.stringify({ version: 1, overall_status: 'completed', tasks: [] }, null, 2),
      'utf8',
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'pause-work',
          '--topic',
          topicDir,
          '--summary',
          'Pausing at the end of the day.',
          '--next-step',
          'Resume implementation tomorrow.',
          '--command',
          'npm run ax -- topic-status --topic .ax/topics/2026-04-09-auth-fix',
        ],
        {
          cwd: REPO_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let error = '';
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(error || `ax pause-work exited ${code}`));
      });
    });

    const handoff = await readFile(join(topicDir, 'handoff.md'), 'utf8');
    const state = await readFile(join(root, '.ax', 'STATE.md'), 'utf8');

    assert.match(handoff, /Pausing at the end of the day/);
    assert.match(handoff, /Resume implementation tomorrow/);
    assert.match(state, /2026-04-09-auth-fix/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
