import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { saveThreadNote } from '../core/memory/threads.js';
import { recordDecision } from '../core/memory/decision-register.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

function runAx(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
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
      else reject(new Error(error || `ax command exited ${code}`));
    });
  });
}

test('ax team-preferences reads back the saved team preference profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-team-prefs-cli-'));

  try {
    const inputPath = join(root, 'team-preferences.json');
    await writeFile(
      inputPath,
      JSON.stringify(
        {
          implementation_style: 'small reversible changes',
          review_style: 'explicit rollback notes',
        },
        null,
        2,
      ),
      'utf8',
    );

    const stdout = await runAx(['team-preferences', '--root', root, '--input', inputPath]);
    const result = JSON.parse(stdout) as { implementation_style: string };
    assert.equal(result.implementation_style, 'small reversible changes');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax promote-thread creates a topic from a saved thread', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-promote-thread-cli-'));

  try {
    await mkdir(join(root, '.git'), { recursive: true });
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track refund migration decisions.',
      note: 'Need a dedicated topic for rollback semantics.',
    });

    const stdout = await runAx([
      'promote-thread',
      '--root',
      root,
      '--name',
      'refund-migration',
      '--request',
      'Create refund rollback topic',
    ]);
    const result = JSON.parse(stdout) as { topicDir: string };
    assert.match(result.topicDir, /\.ax\/topics\//);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax entity-memory combines matching topics, decisions, and threads for an entity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-entity-memory-cli-'));

  try {
    const topicDir = join(root, '.ax', 'topics', '2026-04-09-refund-fix');
    await mkdir(topicDir, { recursive: true });
    await writeFile(join(topicDir, 'request.md'), 'Refund rollback helper\n', 'utf8');
    await writeFile(join(topicDir, 'request-summary.md'), 'Refund rollback helper\n', 'utf8');
    await writeFile(join(topicDir, 'spec.md'), '# Topic Spec\n\nRefund rollback helper\n', 'utf8');
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-09-refund-fix',
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
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback changes must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
      sourceTopic: '2026-04-09-refund-fix',
    });
    await saveThreadNote({
      rootDir: root,
      name: 'refund-migration',
      summary: 'Track refund migration decisions.',
      note: 'Need rollback semantics to stay auditable.',
    });

    const stdout = await runAx(['entity-memory', '--root', root, '--entity', 'refund']);
    const result = JSON.parse(stdout) as {
      entity: string;
      decisions: unknown[];
      threads: unknown[];
      topics: unknown[];
    };
    assert.equal(result.entity, 'refund');
    assert.ok(result.decisions.length >= 1);
    assert.ok(result.threads.length >= 1);
    assert.ok(result.topics.length >= 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
