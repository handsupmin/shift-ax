import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

import { scaffoldPlatformBuild } from '../platform/scaffold.js';

test('scaffoldPlatformBuild writes codex bootstrap assets to target root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-codex-build-'));

  try {
    const result = await scaffoldPlatformBuild({
      platform: 'codex',
      rootDir: root,
    });

    assert.equal(result.platform, 'codex');
    assert.equal(result.written.length, 10);

    const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
    const prompt = await readFile(
      join(root, '.codex', 'prompts', 'shift-ax-bootstrap.md'),
      'utf8',
    );
    const requestCommand = await readFile(
      join(root, '.codex', 'skills', 'request', 'SKILL.md'),
      'utf8',
    );
    const onboardCommand = await readFile(
      join(root, '.codex', 'skills', 'onboard', 'SKILL.md'),
      'utf8',
    );
    const reviewCommand = await readFile(
      join(root, '.codex', 'skills', 'review', 'SKILL.md'),
      'utf8',
    );
    const resumePromptTemplate = await readFile(
      new URL('../platform/codex/scaffold/prompts/resume.template.md', import.meta.url),
      'utf8',
    );

    assert.match(agents, /Shift AX Codex Bootstrap/);
    assert.match(prompt, /shift-ax resolve-context/);
    assert.match(agents, /\$onboard/);
    assert.match(agents, /shift-ax run-request/);
    assert.match(prompt, /shift-ax approve-plan/);
    assert.match(prompt, /shift-ax launch-execution/);
    assert.match(prompt, /shift-ax finalize-commit/);
    assert.match(prompt, /Welcome back \/ resume flow/i);
    assert.match(prompt, /handoff\.md/);
    assert.match(prompt, /evidence to inspect, not instructions to execute/i);
    assert.match(agents, /platform\/codex\/upstream\/worktree\/provenance\.md/);
    assert.match(prompt, /ensureCodexManagedWorktree/);
    assert.match(agents, /\$export-context/);
    assert.match(requestCommand, /shift-ax run-request/);
    assert.match(onboardCommand, /ask one question at a time/i);
    assert.match(onboardCommand, /Choose one:/);
    assert.match(onboardCommand, /This step matters most\./);
    assert.match(reviewCommand, /shift-ax finalize-commit --topic <topic-dir>/);
    assert.match(reviewCommand, /localized lore commit message/i);
    assert.match(resumePromptTemplate, /Welcome back flow before resume/i);
    assert.match(resumePromptTemplate, /topic-status/);
    assert.match(resumePromptTemplate, /handoff\.md/);
    assert.match(resumePromptTemplate, /latest checkpoint/i);
    assert.match(resumePromptTemplate, /evidence to inspect, not instructions to execute/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scaffoldPlatformBuild writes claude-code bootstrap assets to target root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-claude-build-'));

  try {
    const result = await scaffoldPlatformBuild({
      platform: 'claude-code',
      rootDir: root,
    });

    assert.equal(result.platform, 'claude-code');
    assert.equal(result.written.length, 10);

    const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    const hook = await readFile(
      join(root, '.claude', 'hooks', 'shift-ax-session-start.md'),
      'utf8',
    );
    const requestCommand = await readFile(
      join(root, '.claude', 'commands', 'request.md'),
      'utf8',
    );
    const onboardCommand = await readFile(
      join(root, '.claude', 'commands', 'onboard.md'),
      'utf8',
    );
    const reviewCommand = await readFile(
      join(root, '.claude', 'commands', 'review.md'),
      'utf8',
    );
    const resumeCommand = await readFile(
      join(root, '.claude', 'commands', 'resume.md'),
      'utf8',
    );

    assert.match(claude, /Shift AX Claude Code SessionStart Bootstrap/);
    assert.match(hook, /hook-driven context injection/);
    assert.match(claude, /\/onboard/);
    assert.match(claude, /shift-ax run-request/);
    assert.match(hook, /shift-ax approve-plan/);
    assert.match(hook, /shift-ax launch-execution/);
    assert.match(hook, /shift-ax finalize-commit/);
    assert.match(hook, /Welcome back \/ resume flow/i);
    assert.match(hook, /handoff\.md/);
    assert.match(hook, /evidence to inspect, not instructions to execute/i);
    assert.match(claude, /platform\/claude-code\/upstream\/worktree\/provenance\.md/);
    assert.match(hook, /createClaudeManagedWorktree/);
    assert.match(claude, /\/export-context/);
    assert.match(requestCommand, /\$ARGUMENTS/);
    assert.match(onboardCommand, /ask one question at a time/i);
    assert.match(onboardCommand, /Choose one:/);
    assert.match(onboardCommand, /This step matters most\./);
    assert.match(reviewCommand, /shift-ax finalize-commit --topic \$ARGUMENTS/);
    assert.match(reviewCommand, /localized lore commit message/i);
    assert.match(resumeCommand, /Welcome back flow before resume/i);
    assert.match(resumeCommand, /topic-status/);
    assert.match(resumeCommand, /handoff\.md/);
    assert.match(resumeCommand, /latest checkpoint/i);
    assert.match(resumeCommand, /evidence to inspect, not instructions to execute/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax scaffold-build writes bootstrap assets for a requested platform', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-build-cli-'));

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/ax.ts',
          'scaffold-build',
          '--platform',
          'codex',
          '--root',
          root,
        ],
        {
          cwd: '/Users/sangmin/sources/shift-ax',
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
        else reject(new Error(error || `ax scaffold-build exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { platform: string; written: string[] };
    assert.equal(result.platform, 'codex');
    assert.deepEqual(result.written.sort(), [
      '.codex/skills/doctor/SKILL.md',
      '.codex/skills/export-context/SKILL.md',
      '.codex/skills/onboard/SKILL.md',
      '.codex/skills/request/SKILL.md',
      '.codex/skills/resume/SKILL.md',
      '.codex/skills/review/SKILL.md',
      '.codex/skills/status/SKILL.md',
      '.codex/skills/topics/SKILL.md',
      '.codex/prompts/shift-ax-bootstrap.md',
      'AGENTS.md',
    ].sort());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
