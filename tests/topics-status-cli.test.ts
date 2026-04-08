import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax topics-status prints compact summaries for recent topics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topics-status-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-08-auth-refresh',
          phase: 'commit_ready',
          created_at: '2026-04-08T00:00:00.000Z',
          updated_at: '2026-04-08T01:00:00.000Z',
          plan_review_status: 'approved',
          review: {
            overall_status: 'approved',
            commit_allowed: true,
            next_stage: 'finalization',
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
    await writeFile(
      join(topicDir, 'review', 'aggregate.json'),
      JSON.stringify({ version: 1, overall_status: 'approved', commit_allowed: true, next_stage: 'finalization' }, null, 2),
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'topics-status', '--root', root, '--limit', '5'],
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
        else reject(new Error(error || `ax topics-status exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as Array<{ topic_slug: string; phase: string }>;
    assert.equal(result.length, 1);
    assert.equal(result[0]?.topic_slug, '2026-04-08-auth-refresh');
    assert.equal(result[0]?.phase, 'commit_ready');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
