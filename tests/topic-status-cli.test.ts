import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax topic-status prints a compact topic observability summary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-status-cli-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');

  try {
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-auth-refresh',
          phase: 'committed',
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
      JSON.stringify(
        {
          version: 1,
          overall_status: 'completed',
          tasks: [],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'review', 'aggregate.json'),
      JSON.stringify(
        {
          version: 1,
          overall_status: 'approved',
          commit_allowed: true,
          next_stage: 'finalization',
        },
        null,
        2,
      ),
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'topic-status', '--topic', topicDir],
        {
          cwd: REPO_ROOT,
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
        else reject(new Error(error || `ax topic-status exited ${code}`));
      });
    });

    const summary = JSON.parse(stdout) as { phase: string; review_status: string };
    assert.equal(summary.phase, 'committed');
    assert.equal(summary.review_status, 'approved');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
