import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordDecision } from '../core/memory/decision-register.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function seedCommittedTopic(root: string, slug: string, summary: string): Promise<void> {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(topicDir, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), `${summary}\n`, 'utf8');
  await writeFile(join(topicDir, 'spec.md'), `# Topic Spec\n\n${summary}\n`, 'utf8');
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: slug,
        phase: 'committed',
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: slug.includes('newer') ? '2026-04-09T00:00:00.000Z' : '2026-04-08T00:00:00.000Z',
        plan_review_status: 'approved',
      },
      null,
      2,
    ),
    'utf8',
  );
}

test('ax recall supports topic, decision, and repo scopes with ranked results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-recall-cli-'));

  try {
    await seedCommittedTopic(root, '2026-04-08-refund-fix', 'Refund rollback helper and tests');
    await seedCommittedTopic(root, '2026-04-09-refund-fix-newer', 'Refund rollback helper and tests');
    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
      sourceTopic: '2026-04-09-refund-fix-newer',
    });

    const run = (args: string[]) =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--import', 'tsx', 'scripts/ax.ts', ...args],
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
          else reject(new Error(error || `ax recall exited ${code}`));
        });
      });

    const topics = JSON.parse(await run(['recall', '--root', root, '--scope', 'topic', '--query', 'refund rollback'])) as Array<{ topic_slug: string }>;
    const decisions = JSON.parse(await run(['recall', '--root', root, '--scope', 'decision', '--query', 'refund rollback'])) as Array<{ title: string }>;
    const repo = JSON.parse(await run(['recall', '--root', root, '--scope', 'repo', '--query', 'refund rollback'])) as { base_context: unknown[]; topics: unknown[]; decisions: unknown[] };

    assert.equal(topics[0]?.topic_slug, '2026-04-09-refund-fix-newer');
    assert.equal(decisions[0]?.title, 'Require refund rollback traceability');
    assert.ok(Array.isArray(repo.base_context));
    assert.ok(Array.isArray(repo.topics));
    assert.ok(Array.isArray(repo.decisions));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
