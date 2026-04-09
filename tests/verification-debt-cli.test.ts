import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax verification-debt prints unresolved verification debt items', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-verification-debt-cli-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');

  try {
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
          verification: [
            {
              command: 'npm test',
              exit_code: 1,
              stdout: '',
              stderr: 'failing test',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'verification-debt', '--root', root],
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
        else reject(new Error(error || `ax verification-debt exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as Array<{ message: string }>;
    assert.equal(result.length, 1);
    assert.match(result[0]?.message ?? '', /npm test/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
