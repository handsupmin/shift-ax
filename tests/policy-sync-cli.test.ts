import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import { startRequestPipeline } from '../core/planning/request-pipeline.js';
import { onboardProjectContext } from '../core/context/onboarding.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-policy-sync-cli-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('ax sync-policy-context records completion and returns the workflow to approved', async () => {
  const repoRoot = await createGitRepo();

  try {
    await onboardProjectContext({
      rootDir: repoRoot,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
      ],
    });

    const started = await startRequestPipeline({
      rootDir: repoRoot,
      request: 'Build safer auth refresh flow',
      brainstormContent: [
        '# Brainstorm',
        '',
        '## Base-Context Policy Updates',
        '',
        '- Update Auth policy to reflect the new revocation rule.',
        '',
      ].join('\n'),
      specContent: '# Topic Spec\n\n## Goal\n\nImplement auth refresh token rotation.\n',
      implementationPlanContent: [
        '# Implementation Plan',
        '',
        '## Base-Context Policy Updates',
        '',
        '- Update Auth policy to reflect the new revocation rule.',
        '',
      ].join('\n'),
      baseBranch: 'main',
    });

    await recordPlanReviewDecision({
      topicDir: started.topicDir,
      reviewer: 'Alex Reviewer',
      status: 'approved',
    });

    await mkdir(join(repoRoot, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(repoRoot, 'docs', 'base-context', 'auth-policy.md'),
      '# Auth Policy\n\nUpdated.\n',
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'sync-policy-context',
          '--topic',
          started.topicDir,
          '--summary',
          'Updated the shared auth policy first.',
          '--path',
          'docs/base-context/auth-policy.md',
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
        else reject(new Error(error || `ax sync-policy-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { status: string };
    assert.equal(result.status, 'completed');

    const workflow = JSON.parse(
      await readFile(join(started.topicDir, 'workflow-state.json'), 'utf8'),
    ) as { phase: string };
    assert.equal(workflow.phase, 'approved');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
