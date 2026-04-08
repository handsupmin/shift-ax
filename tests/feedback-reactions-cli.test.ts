import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { bootstrapTopic } from '../core/topics/bootstrap.js';
import { topicArtifactPath } from '../core/topics/topic-artifacts.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax react-feedback reopens a topic after downstream review feedback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-feedback-cli-'));

  try {
    const topic = await bootstrapTopic({
      rootDir: root,
      request: 'Build safer auth refresh flow',
    });

    await mkdir(join(topic.topicDir, 'review'), { recursive: true });
    await writeFile(
      topicArtifactPath(topic.topicDir, 'workflow_state'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: topic.topicSlug,
          phase: 'commit_ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'react-feedback',
          '--topic',
          topic.topicDir,
          '--kind',
          'review-changes-requested',
          '--summary',
          'Reviewer requested a rollback safety test.',
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
        else reject(new Error(error || `ax react-feedback exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { workflow: { phase: string } };
    assert.equal(result.workflow.phase, 'implementation_running');

    const workflow = JSON.parse(
      await readFile(topicArtifactPath(topic.topicDir, 'workflow_state'), 'utf8'),
    ) as { phase: string };
    assert.equal(workflow.phase, 'implementation_running');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
