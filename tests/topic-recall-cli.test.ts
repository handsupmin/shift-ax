import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax recall-topics prints matching committed topic summaries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-topic-recall-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request.md'), 'Build safer auth refresh flow\n', 'utf8');
    await writeFile(join(topicDir, 'request-summary.md'), 'Reviewed auth refresh delivery flow.\n', 'utf8');
    await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\nKeep users signed in during token rotation.\n', 'utf8');
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

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'recall-topics', '--root', root, '--query', 'auth token rotation'],
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
        else reject(new Error(error || `ax recall-topics exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as Array<{ topic_slug: string }>;
    assert.equal(result.length, 1);
    assert.equal(result[0]?.topic_slug, '2026-04-08-auth-refresh');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
