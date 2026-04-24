import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { onboardProjectContext } from '../core/context/onboarding.js';
import { recordPlanReviewDecision } from '../core/planning/plan-review.js';
import { runDoctor } from '../core/diagnostics/doctor.js';
import { startRequestPipeline } from '../core/planning/request-pipeline.js';
import { withTempGlobalHome } from './helpers/global-home.js';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-doctor-git-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('runDoctor fails when the global index points to a missing document', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-doctor-home-', async (home) => {
      await writeFile(
        join(home, 'index.md'),
        '# Shift AX Global Index\n\n## Work Types\n\n- API development -> work-types/api-development.md\n\n## Domain Language\n\n- None yet.\n',
        'utf8',
      );

      const report = await runDoctor({ rootDir: root });

      assert.equal(report.overall_status, 'fail');
      assert.equal(report.base_context.status, 'fail');
      assert.match(report.base_context.message, /missing|unresolved/i);
      assert.equal(report.base_context.quality_issues.some((issue) => /missing document/i.test(issue)), true);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runDoctor fails path-like or duplicate dictionary labels', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-doctor-quality-home-', async (home) => {
      await mkdir(join(home, 'work-types'), { recursive: true });
      await writeFile(join(home, 'work-types', 'api-development.md'), '# API development\n', 'utf8');
      await writeFile(
        join(home, 'index.md'),
        [
          '# Shift AX Global Index',
          '',
          '## Work Types',
          '',
          '- docs/work-types/api-development.md -> work-types/api-development.md',
          '- docs/work-types/api-development.md -> work-types/api-development.md',
          '',
        ].join('\n'),
        'utf8',
      );

      const report = await runDoctor({ rootDir: root });

      assert.equal(report.base_context.status, 'fail');
      assert.equal(report.base_context.quality_issues.some((issue) => /path-like/i.test(issue)), true);
      assert.equal(report.base_context.quality_issues.some((issue) => /Duplicate/i.test(issue)), true);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runDoctor surfaces awaiting_policy_sync topics and launcher readiness as warnings', async () => {
  const root = await createGitRepo();

  try {
    await withTempGlobalHome('shift-ax-doctor-topic-home-', async () => {
      await onboardProjectContext({
        rootDir: root,
        primaryRoleSummary: 'I maintain auth APIs.',
        workTypes: [
          {
            name: 'API development',
            repositories: [
              {
                repository: 'auth-api',
                repositoryPath: root,
                purpose: 'Auth API',
                directories: ['src'],
                workflow: 'Change API code and tests together.',
              },
            ],
          },
        ],
      });

      const started = await startRequestPipeline({
        rootDir: root,
        request: 'Build safer auth refresh flow',
        brainstormContent: '# Brainstorm\n\n## Global Knowledge Updates\n\n- None yet.\n',
        specContent: '# Topic Spec\n\n## Goal\n\nImplement auth refresh token rotation.\n',
        implementationPlanContent:
          '# Implementation Plan\n\n## Base-Context Policy Updates\n\n- Update Auth policy before implementation.\n',
        baseBranch: 'main',
      });

      await recordPlanReviewDecision({
        topicDir: started.topicDir,
        reviewer: 'Alex Reviewer',
        status: 'approved',
      });

      const report = await runDoctor({
        rootDir: root,
        topicDir: started.topicDir,
        platform: 'codex',
        commandExists: (command) => command === 'tmux',
      });

      assert.equal(report.overall_status, 'warn');
      assert.equal(report.topic?.status, 'warn');
      assert.equal(report.topic?.phase, 'awaiting_policy_sync');
      assert.match(report.topic?.message ?? '', /policy/i);
      assert.equal(report.launchers?.status, 'warn');
      assert.match(report.launchers?.message ?? '', /codex/i);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
