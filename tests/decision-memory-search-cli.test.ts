import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordDecision } from '../core/memory/decision-register.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax decisions returns ranked decision-memory matches when query search is used', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-decision-memory-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-08-auth-refresh');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request-summary.md'), 'Auth refresh rollback must stay safe.\n', 'utf8');
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

    await recordDecision({
      rootDir: root,
      title: 'Require rollback-safe auth refresh',
      summary: 'Refresh changes must preserve a safe rollback path for session recovery.',
      category: 'policy',
      validFrom: '2026-04-08',
      sourceTopic: '2026-04-08-auth-refresh',
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'decisions',
          '--root',
          root,
          '--query',
          'auth refresh rollback',
          '--limit',
          '1',
        ],
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
        else reject(new Error(error || `ax decisions exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as Array<{ title: string; score: number; source_topic_summary?: string }>;
    assert.equal(result.length, 1);
    assert.equal(result[0]?.title, 'Require rollback-safe auth refresh');
    assert.ok((result[0]?.score ?? 0) > 0);
    assert.match(result[0]?.source_topic_summary ?? '', /rollback/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
